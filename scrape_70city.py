#!/usr/bin/env python3
"""
70 City Housing Price Index Scraper
Scrapes the latest 70-city housing price data from stats.gov.cn
Updates public/data.json in the React project directory

Usage: python3 scrape_70city.py
Output: public/data.json (updated in place)
"""

import re
import json
import os
import urllib.request
import urllib.error
import sys
from html.parser import HTMLParser

BASE_URL = "https://www.stats.gov.cn/sj/zxfb/"

def find_latest_page():
    """Find the latest 70-city housing price page on stats.gov.cn"""
    req = urllib.request.Request(
        BASE_URL,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html"
        }
    )
    with urllib.request.urlopen(req, timeout=15) as resp:
        html = resp.read().decode('utf-8', errors='ignore')
    
    pattern = r'href=[\"\']([^\"\']*70个大中城市商品住宅[^\"\']*)[\"\']'
    match = re.search(pattern, html)
    if not match:
        pattern2 = r'href=[\"\']([^\"\']*70[^\"\']*)[\"\'][^>]*>[^<]*70个大中城市'
        match = re.search(pattern2, html)
    
    if match:
        url = match.group(1)
        if not url.startswith('http'):
            url = 'https://www.stats.gov.cn' + url if url.startswith('/') else BASE_URL + url
        return url
    
    from datetime import datetime
    today = datetime.now()
    for m in range(12):
        pub_month = today.month - m
        pub_year = today.year
        if pub_month <= 0:
            pub_month += 12
            pub_year -= 1
        url = f"https://www.stats.gov.cn/sj/zxfb/{pub_year}{pub_month:02d}/t{pub_year}{pub_month:02d}15_XXXXXXX.html"
    return None


def download_page(url):
    """Download the 70-city data page"""
    req = urllib.request.Request(
        url,
        headers={
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
            "Accept": "text/html"
        }
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode('utf-8', errors='ignore')


def clean_city(name):
    """Remove spaces from city names"""
    return name.replace(' ', '')


def parse_table(html, start_marker, end_marker=None):
    """Parse a 70-city data table from the HTML"""
    start = html.find(start_marker)
    if start < 0:
        print(f"  Marker '{start_marker[:30]}' not found!")
        return []
    
    end = html.find(end_marker) if end_marker and end_marker in html else start + 200000
    if end <= start:
        end = start + 200000
    
    area = html[start:end]
    tables = re.findall(r'<table[^>]*>.*?</table>', area, re.DOTALL)
    
    if not tables:
        print("  No table found!")
        return []
    
    table = tables[0]
    rows = re.findall(r'<tr[^>]*>(.*?)</tr>', table, re.DOTALL)
    
    cities = []
    for row in rows[2:]:
        tds = re.findall(r'<td[^>]*>.*?</td>', row, re.DOTALL)
        if len(tds) < 8:
            continue
        
        texts = []
        for td in tds:
            t = re.sub(r'<[^>]+>', '', td).strip()
            t = re.sub(r'\s+', ' ', t)
            texts.append(t)
        
        left_city = clean_city(texts[0])
        cities.append({
            "city": left_city,
            "环比": texts[1],
            "同比": texts[2],
            "定基": texts[3]
        })
        
        right_city = clean_city(texts[4])
        cities.append({
            "city": right_city,
            "环比": texts[5],
            "同比": texts[6],
            "定基": texts[7]
        })
    
    return cities


def extract_period_and_date(html):
    """Extract data period and publish date from the page"""
    period_match = re.search(r'(\d{4})年(\d{1,2})月份?70个大中城市', html)
    period = period_match.group(0).replace('70个大中城市商品住宅销售价格变动情况', '').replace('70个大中城市', '').strip() if period_match else "未知"
    
    date_match = re.search(r'(\d{4}-\d{2}-\d{2})\s+\d{2}:\d{2}', html)
    publish_date = date_match.group(1) if date_match else "未知"
    
    return period, publish_date


def main():
    print("🔍 查找国家统计局最新70城数据...")
    
    latest_url = find_latest_page()
    url = latest_url or "https://www.stats.gov.cn/sj/zxfb/202605/t20260518_1963715.html"
    
    print(f"📥 下载数据页面: {url}")
    html = download_page(url)
    print(f"   页面大小: {len(html)} 字节")
    
    period, publish_date = extract_period_and_date(html)
    print(f"📅 数据周期: {period}")
    print(f"📅 发布日期: {publish_date}")
    
    print("\n📊 解析新建商品住宅数据...")
    new_house = parse_table(html, '新建商品住宅销售价格指数', '二手住宅销售价格指数')
    print(f"   ✅ {len(new_house)} 个城市")
    
    print("\n📊 解析二手住宅数据...")
    second_hand = parse_table(html, '二手住宅销售价格指数', None)
    if len(second_hand) == 0:
        second_hand = parse_table(html, '二手住宅销售价格指数', '表2')
    print(f"   ✅ {len(second_hand)} 个城市")
    
    if len(new_house) != 70 or len(second_hand) != 70:
        print(f"\n⚠️ 警告: 新房{len(new_house)}城 / 二手{len(second_hand)}城 (期望70城)")
    
    output = {
        "period": period,
        "publish_date": publish_date,
        "source": url,
        "new_house": new_house,
        "second_hand": second_hand
    }
    
    # Write to public/data.json (React project root)
    script_dir = os.path.dirname(os.path.abspath(__file__))
    data_path = os.path.join(script_dir, 'public', 'data.json')
    
    with open(data_path, 'w', encoding='utf-8') as f:
        json.dump(output, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ 数据已保存到: {data_path}")
    
    # Preview key cities
    key_cities = ['杭州', '大连', '哈尔滨', '厦门']
    print(f"\n📈 重点关注城市 ({period}):")
    for c in new_house:
        if c['city'] in key_cities:
            hb = (float(c['环比']) - 100)
            tb = (float(c['同比']) - 100)
            hb_str = f"+{hb:.1f}%" if hb >= 0 else f"{hb:.1f}%"
            tb_str = f"+{tb:.1f}%" if tb >= 0 else f"{tb:.1f}%"
            print(f"  {c['city']}: 环比 {hb_str}, 同比 {tb_str}")
    
    print()


if __name__ == '__main__':
    main()
