import type { RawData, HouseType, Metric, MonthEntry } from '../types'

/** 城市 → 省份映射（70城 → 35省级行政区） */
export const CITY_PROVINCE: Record<string, string> = {
  北京: '北京市', 上海: '上海市', 天津: '天津市', 重庆: '重庆市',
  // 河北省
  石家庄: '河北省', 唐山: '河北省', 秦皇岛: '河北省',
  // 山西省
  太原: '山西省',
  // 内蒙古
  呼和浩特: '内蒙古自治区', 包头: '内蒙古自治区',
  // 辽宁省
  沈阳: '辽宁省', 大连: '辽宁省', 丹东: '辽宁省', 锦州: '辽宁省',
  // 吉林省
  长春: '吉林省', 吉林: '吉林省',
  // 黑龙江省
  哈尔滨: '黑龙江省', 牡丹江: '黑龙江省',
  // 江苏省
  南京: '江苏省', 无锡: '江苏省', 扬州: '江苏省', 徐州: '江苏省',
  // 浙江省
  杭州: '浙江省', 宁波: '浙江省', 温州: '浙江省', 金华: '浙江省',
  // 安徽省
  合肥: '安徽省', 蚌埠: '安徽省', 安庆: '安徽省',
  // 福建省
  福州: '福建省', 厦门: '福建省', 泉州: '福建省',
  // 江西省
  南昌: '江西省', 九江: '江西省', 赣州: '江西省',
  // 山东省
  济南: '山东省', 青岛: '山东省', 烟台: '山东省', 济宁: '山东省',
  // 河南省
  郑州: '河南省', 洛阳: '河南省', 平顶山: '河南省',
  // 湖北省
  武汉: '湖北省', 宜昌: '湖北省', 襄阳: '湖北省',
  // 湖南省
  长沙: '湖南省', 岳阳: '湖南省', 常德: '湖南省',
  // 广东省
  广州: '广东省', 深圳: '广东省', 韶关: '广东省', 湛江: '广东省', 惠州: '广东省',
  // 广西
  南宁: '广西壮族自治区', 桂林: '广西壮族自治区', 北海: '广西壮族自治区',
  // 海南省
  海口: '海南省', 三亚: '海南省',
  // 四川省
  成都: '四川省', 泸州: '四川省', 南充: '四川省',
  // 贵州省
  贵阳: '贵州省', 遵义: '贵州省',
  // 云南省
  昆明: '云南省', 大理: '云南省',
  // 陕西省
  西安: '陕西省',
  // 甘肃省
  兰州: '甘肃省',
  // 青海省
  西宁: '青海省',
  // 宁夏
  银川: '宁夏回族自治区',
  // 新疆
  乌鲁木齐: '新疆维吾尔自治区',
}

/** 加载历史房价数据 */
export async function loadHistoricalData(): Promise<{
  months: string[]
  entries: Record<string, MonthEntry>
}> {
  const res = await fetch(import.meta.env.BASE_URL + 'historical_data.json')
  if (!res.ok) throw new Error(`Failed to load historical data: ${res.status}`)
  const raw: RawData = await res.json()
  const months = Object.keys(raw.months).sort()
  return { months, entries: raw.months }
}

/** 加载中国 GeoJSON */
export async function loadChinaGeo(): Promise<any> {
  const res = await fetch(import.meta.env.BASE_URL + 'china.json')
  if (!res.ok) throw new Error(`Failed to load china geo: ${res.status}`)
  return res.json()
}

/** 解析城市数据字符串为数字 */
function parseVal(v: string): number {
  const n = parseFloat(v)
  return isNaN(n) ? 100 : n
}

/** 获取某月某类型数据 */
export function getMonthCities(
  entry: MonthEntry,
  houseType: HouseType
): Array<{ city: string; hb: number; tb: number; dj: number }> {
  const list = houseType === 'new_house' ? entry.new_house : entry.second_hand
  return list.map(d => ({
    city: d.city,
    hb: parseVal(d['环比']),
    tb: parseVal(d['同比']),
    dj: parseVal(d['定基']),
  }))
}

/** 获取某月排序 */
export function getMonthRanking(
  entry: MonthEntry,
  houseType: HouseType,
  metric: Metric
): Array<{ city: string; value: number }> {
  const key = metric === '环比' ? 'hb' : metric === '同比' ? 'tb' : 'dj'
  return getMonthCities(entry, houseType)
    .map(d => ({ city: d.city, value: (d as any)[key] }))
    .sort((a, b) => b.value - a.value)
}

/** 累计指数：以首个有数据的月份为基数 1.0 */
export function calcCumulativeIndex(
  entries: Record<string, MonthEntry>,
  months: string[],
  city: string,
  houseType: HouseType
): Array<{ month: string; index: number }> {
  let cum = 1.0
  const result: Array<{ month: string; index: number }> = []
  for (const m of months) {
    const list = houseType === 'new_house' ? entries[m].new_house : entries[m].second_hand
    const found = list.find(c => c.city === city)
    if (found) {
      cum = cum * (parseVal(found['环比']) / 100)
      result.push({ month: m, index: cum })
    } else {
      result.push({ month: m, index: cum })
    }
  }
  return result
}

/** 将城市级数据聚合为省份级（取省内各城市平均值） */
export function aggregateToProvince(
  entry: MonthEntry,
  houseType: HouseType,
): Array<{ name: string; hb: number; tb: number; dj: number }> {
  const cities = getMonthCities(entry, houseType)
  // 按省份分组
  const provinceMap: Record<string, { hb: number[]; tb: number[]; dj: number[] }> = {}
  for (const c of cities) {
    const prov = CITY_PROVINCE[c.city]
    if (!prov) continue // 跳过无法映射的城市
    if (!provinceMap[prov]) provinceMap[prov] = { hb: [], tb: [], dj: [] }
    provinceMap[prov].hb.push(c.hb)
    provinceMap[prov].tb.push(c.tb)
    provinceMap[prov].dj.push(c.dj)
  }
  // 求平均
  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length
  return Object.entries(provinceMap).map(([name, v]) => ({
    name,
    hb: avg(v.hb),
    tb: avg(v.tb),
    dj: avg(v.dj),
  }))
}
