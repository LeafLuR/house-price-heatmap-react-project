#!/usr/bin/env python3
"""
按月份抓取并入库 70 城房价数据（补历史缺月用，也可日常用）

用法：
  python3 scrape_by_month.py 2026-05 2026-06 2026-07 2026-08 2026-09
  python3 scrape_by_month.py --latest        # 只抓最新一期
  python3 scrape_by_month.py --dry-run 2026-09   # 只解析打印，不写文件

行为：
  1. 从国家统计局「数据发布」栏目（含 index_1..index_7 分页）建立 月份 -> 文章URL/发布日期 映射
  2. 逐月下载文章页，复用 scrape_70city.py 的 parse_table 解析新房/二手表
  3. 直接写入 public/historical_data.json（按月 upsert，不重复）
  4. 把最后一期同时写入 public/data.json（前端"最新一期"用）
"""
import json
import os
import re
import sys
import time
import urllib.request

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from scrape_70city import parse_table, extract_period_and_date  # noqa: E402

BASE = "https://www.stats.gov.cn"
LIST_URLS = ["https://www.stats.gov.cn/sj/zxfb/"] + [
    f"https://www.stats.gov.cn/sj/zxfb/index_{i}.html" for i in range(1, 10)
]
UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36"

HERE = os.path.dirname(os.path.abspath(__file__))
PUBLIC = os.path.join(HERE, "public")
DATA_JSON = os.path.join(PUBLIC, "data.json")
HIST_JSON = os.path.join(PUBLIC, "historical_data.json")


def get(url, timeout=30):
    req = urllib.request.Request(url, headers={"User-Agent": UA, "Referer": BASE + "/sj/zxfb/"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return r.read().decode("utf-8", errors="ignore")


def build_index():
    """返回 {YYYY-MM: {'href':..., 'publish_date':...}}"""
    idx = {}
    for lu in LIST_URLS:
        try:
            html = get(lu)
        except Exception as e:
            print(f"  ⚠️  列表页失败 {lu}: {e}")
            continue
        for m in re.finditer(
            r'href="\./(\d{6}/t\d{8}_\d+\.html)"[^>]*?title=\'([^\']*?(\d{4})年(\d{1,2})月份70个大中城市[^\']*)\'',
            html,
        ):
            href, _, y, mo = m.groups()
            key = f"{y}-{int(mo):02d}"
            # 发布日期取该条 <a> 之后的第一个 <span> YYYY-MM-DD
            tail = html[m.end():m.end() + 400]
            dm = re.search(r"(\d{4}-\d{2}-\d{2})", tail)
            # 兜底：从文件名 t20261019_xxx.html 推出发布日期
            fm = re.search(r"/t(\d{4})(\d{2})(\d{2})_\d+\.html$", href)
            fallback = f"{fm.group(1)}-{fm.group(2)}-{fm.group(3)}" if fm else "未知"
            idx.setdefault(key, {"href": href, "publish_date": dm.group(1) if dm else fallback})
    return idx


def fetch_month(key, meta):
    url = f"{BASE}/sj/zxfb/{meta['href']}"
    print(f"📥 {key}: {url}")
    html = get(url)
    period, _ = extract_period_and_date(html)
    if not re.match(r"\d{4}年\d{1,2}月", period or ""):
        period = f"{key[:4]}年{int(key[5:])}月份"
    new_house = parse_table(html, "新建商品住宅销售价格指数", "二手住宅销售价格指数")
    second_hand = parse_table(html, "二手住宅销售价格指数", None)
    print(f"   新房 {len(new_house)} 城 / 二手 {len(second_hand)} 城")
    if len(new_house) == 0 or len(second_hand) == 0:
        raise RuntimeError(f"{key} 解析失败（表格为空）")
    return {
        "period": period,
        "publish_date": meta.get("publish_date", "未知"),
        "source": url,
        "new_house": new_house,
        "second_hand": second_hand,
    }


def upsert(hist, key, scraped):
    """把一个月的抓取结果写入 historical_data.json（幂等）"""
    hist["months"][key] = {
        "period": scraped["period"],
        "date": scraped["publish_date"],
        "new_house": scraped["new_house"],
        "second_hand": scraped["second_hand"],
        "new_count": len(scraped["new_house"]),
        "second_count": len(scraped["second_hand"]),
    }
    for house_type, prefix in (("new_house", "新房"), ("second_hand", "二手")):
        for c in scraped[house_type]:
            city = c["city"]
            if city not in hist["city_trends"]:
                hist["city_trends"][city] = {
                    "新房环比": [], "新房同比": [], "新房定基": [],
                    "二手环比": [], "二手同比": [], "二手定基": [],
                }
            for suffix in ("环比", "同比", "定基"):
                tkey = prefix + suffix
                val = float(c[suffix]) if c.get(suffix) else None
                arr = hist["city_trends"][city].setdefault(tkey, [])
                hit = next((e for e in arr if e["month"] == key), None)
                if hit:
                    hit["value"] = val
                    hit["source"] = "stats.gov.cn"
                else:
                    arr.append({"month": key, "value": val, "source": "stats.gov.cn"})
                arr.sort(key=lambda e: e["month"])


def main():
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    dry = "--dry-run" in sys.argv

    print("🔍 建立月份索引...")
    idx = build_index()
    print(f"   共 {len(idx)} 期: {min(idx)} ~ {max(idx)}")

    if "--latest" in sys.argv or not args:
        targets = [max(idx)]
    else:
        targets = sorted(set(args))

    print(f"🎯 目标月份: {targets}")

    hist = None
    if not dry:
        with open(HIST_JSON, encoding="utf-8") as f:
            hist = json.load(f)
        before = len(hist["months"])

    latest_scraped = None
    for key in targets:
        if key not in idx:
            print(f"❌ {key} 不在统计局列表里，跳过")
            continue
        try:
            scraped = fetch_month(key, idx[key])
        except Exception as e:
            print(f"❌ {key} 抓取失败: {e}")
            continue
        latest_scraped = scraped
        if dry:
            print(f"   [dry] {key} 新房前3: {scraped['new_house'][:3]}")
            continue
        upsert(hist, key, scraped)
        print(f"   ✅ {key} 已入库")
        time.sleep(1)

    if dry or hist is None:
        return

    hist["meta"]["last_updated"] = time.strftime("%Y-%m-%d")
    hist["meta"]["total_months"] = len(hist["months"])
    hist["meta"]["total_cities"] = len(hist["city_trends"])
    hist["meta"]["total_articles"] = len(hist["months"])
    all_months = sorted(hist["months"])
    hist["meta"]["date_range"] = [all_months[0], all_months[-1]]
    hist["months"] = {k: hist["months"][k] for k in all_months}

    with open(HIST_JSON, "w", encoding="utf-8") as f:
        json.dump(hist, f, ensure_ascii=False, separators=(",", ":"))

    # data.json 始终保存最新一期
    newest = all_months[-1]
    latest = dict(hist["months"][newest])
    latest["publish_date"] = latest.get("date", "未知")
    with open(DATA_JSON, "w", encoding="utf-8") as f:
        json.dump(latest, f, ensure_ascii=False, indent=2)

    print(f"\n✅ historical_data.json: {before} -> {len(hist['months'])} 期，最新 {newest}")
    print(f"✅ data.json 已更新为 {newest}")
    print(f"   区间: {all_months[0]} ~ {all_months[-1]}")

    for key in targets:
        if key in hist["months"]:
            m = hist["months"][key]
            prec = {c["city"]: c for c in m["new_house"]}
            print(f"\n📈 {key} 重点城市（新房环比/同比）:")
            for city in ("杭州", "大连", "哈尔滨", "厦门"):
                if city in prec:
                    hb = float(prec[city]["环比"]) - 100
                    tb = float(prec[city]["同比"]) - 100
                    print(f"   {city}: {hb:+.1f}% / {tb:+.1f}%")


if __name__ == "__main__":
    main()
