/** 单城单月数据（来自 JSON） */
export interface CityMonth {
  city: string
  /** 环比 (%) */
  '环比': string
  /** 同比 (%) */
  '同比': string
  /** 定基 (2020年=100) */
  '定基': string
}

/** 单月完整数据 */
export interface MonthEntry {
  period: string
  date: string
  new_house: CityMonth[]
  second_hand: CityMonth[]
}

/** 原始 JSON 根结构 */
export interface RawData {
  meta: {
    total_articles: number
    date_range: [string, string]
    total_cities: number
  }
  months: Record<string, MonthEntry>
}

/** 房屋类型 */
export type HouseType = 'new_house' | 'second_hand'

/** 指标 */
export type Metric = '环比' | '同比' | '定基'

/** 国家统计局70城列表 */
export const CITY_NAMES: string[] = [
  '北京','上海','广州','深圳','天津','重庆','石家庄','太原','呼和浩特',
  '沈阳','大连','长春','哈尔滨','南京','杭州','宁波','合肥','福州','厦门',
  '南昌','济南','青岛','郑州','武汉','长沙','南宁','海口','成都','贵阳',
  '昆明','西安','兰州','西宁','银川','乌鲁木齐','唐山','秦皇岛','包头',
  '丹东','锦州','吉林','牡丹江','无锡','扬州','徐州','温州','金华',
  '蚌埠','安庆','泉州','九江','赣州','烟台','济宁','洛阳','平顶山',
  '宜昌','襄阳','岳阳','常德','韶关','湛江','惠州','桂林','北海',
  '三亚','泸州','南充','遵义','大理'
]

/** 每城市对应颜色 */
export const CITY_PALETTE: string[] = [
  '#fbbf24','#22c55e','#ef4444','#3b82f6','#a78bfa','#f472b6','#34d399',
  '#f97316','#14b8a6','#e879f9'
]
