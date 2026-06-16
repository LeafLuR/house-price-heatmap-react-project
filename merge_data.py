#!/usr/bin/env python3
"""
Merge latest scraped data into historical_data.json
Run after scrape_70city.py

Usage: python3 merge_data.py
"""
import json
import os
import sys
from datetime import datetime

script_dir = os.path.dirname(os.path.abspath(__file__))
public_dir = os.path.join(script_dir, 'public')
data_json_path = os.path.join(public_dir, 'data.json')
historical_path = os.path.join(public_dir, 'historical_data.json')

if not os.path.exists(data_json_path):
    print("❌ public/data.json not found. Run scrape_70city.py first.")
    sys.exit(1)

# Load scraped data
with open(data_json_path, encoding='utf-8') as f:
    scraped = json.load(f)

period = scraped.get('period', '')
publish_date = scraped.get('publish_date', '')

# Extract month key from period (e.g. "2026年4月" -> "2026-04")
m = __import__('re').match(r'(\d{4})年(\d{1,2})月', period)
if not m:
    print(f"❌ Cannot parse period: {period}")
    sys.exit(1)

year, month = int(m.group(1)), int(m.group(2))
month_key = f"{year}-{month:02d}"

print(f"📅 数据月份: {month_key}")

# Load historical data
with open(historical_path, encoding='utf-8') as f:
    historical = json.load(f)

if month_key in historical['months']:
    print(f"⚠️  {month_key} 已存在于历史数据中，将覆盖更新")
else:
    print(f"➕  {month_key} 为新月份，将追加到历史数据")

# Create month entry
month_entry = {
    "period": period,
    "date": publish_date,
    "new_house": scraped['new_house'],
    "second_hand": scraped['second_hand'],
    "new_count": len(scraped['new_house']),
    "second_count": len(scraped['second_hand'])
}

# Update or add the month
historical['months'][month_key] = month_entry

# Update city_trends with the new data
for house_type in ['new_house', 'second_hand']:
    metric_key = '新房环比' if house_type == 'new_house' else '二手环比'
    for c in scraped[house_type]:
        city = c['city']
        if city not in historical['city_trends']:
            historical['city_trends'][city] = {
                '新房环比': [], '新房同比': [], '新房定基': [],
                '二手环比': [], '二手同比': [], '二手定基': []
            }
        
        # Update trends for this city
        for suffix, raw_key in [('环比', '环比'), ('同比', '同比'), ('定基', '定基')]:
            trend_key = f"{'新房' if house_type == 'new_house' else '二手'}{suffix}"
            val = float(c[raw_key]) if c[raw_key] else None
            
            # Find and update existing entry, or append
            found = False
            for entry in historical['city_trends'][city].get(trend_key, []):
                if entry['month'] == month_key:
                    entry['value'] = val
                    entry['source'] = 'stats.gov.cn'
                    found = True
                    break
            
            if not found:
                historical['city_trends'][city].setdefault(trend_key, []).append({
                    'month': month_key,
                    'value': val,
                    'source': 'stats.gov.cn'
                })

# Update meta
historical.setdefault('meta', {})
historical['meta']['last_updated'] = datetime.now().strftime('%Y-%m-%d')
historical['meta']['total_months'] = len(historical['months'])
historical['meta']['total_cities'] = len(historical['city_trends'])

# Save
with open(historical_path, 'w', encoding='utf-8') as f:
    json.dump(historical, f, ensure_ascii=False, indent=2)

print(f"✅ 已更新: {historical_path}")
print(f"   月份数: {historical['meta']['total_months']}")
print(f"   城市数: {historical['meta']['total_cities']}")
print()

# Preview key cities
key_cities = ['杭州', '大连', '哈尔滨', '厦门']
print(f"📈 {month_key} 重点关注城市:")
for c in scraped['new_house']:
    if c['city'] in key_cities:
        hb = (float(c['环比']) - 100)
        tb = (float(c['同比']) - 100)
        hb_str = f"+{hb:.1f}%" if hb >= 0 else f"{hb:.1f}%"
        tb_str = f"+{tb:.1f}%" if tb >= 0 else f"{tb:.1f}%"
        print(f"  {c['city']}: 环比 {hb_str}, 同比 {tb_str}")
