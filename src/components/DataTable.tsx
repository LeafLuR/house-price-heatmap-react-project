import { Table, Tag } from 'antd'
import type { MonthEntry, HouseType, Metric } from '../types'
import { getMonthCities } from '../utils/dataLoader'

interface Props {
  entry: MonthEntry | null
  houseType: HouseType
  metric: Metric
  focusCities: string[]
  /** 点击城市名 → 通知父组件聚焦地图 */
  onCityClick?: (city: string) => void
  /** 当前地图聚焦的城市（高亮标记） */
  mapFocusCity?: string | null
}

export default function DataTable({ entry, houseType, metric, focusCities, onCityClick, mapFocusCity }: Props) {
  if (!entry) return null

  const cities = getMonthCities(entry, houseType)
  const key = metric === '环比' ? 'hb' : metric === '同比' ? 'tb' : 'dj'
  const focusSet = new Set(focusCities)

  const dataSource = cities
    .map(c => ({
      key: c.city,
      city: c.city,
      hb: c.hb,
      tb: c.tb,
      dj: c.dj,
      focused: focusSet.has(c.city),
    }))
    .sort((a, b) => (b as any)[key] - (a as any)[key])

  const columns = [
    {
      title: '城市',
      dataIndex: 'city',
      key: 'city',
      render: (v: string, record: any) => {
        const isMapFocused = mapFocusCity === v
        return (
          <span
            onClick={() => onCityClick?.(v)}
            style={{
              cursor: 'pointer',
              color: isMapFocused ? '#1677ff' : record.focused ? '#1890ff' : undefined,
              fontWeight: isMapFocused ? 700 : undefined,
              textDecoration: isMapFocused ? 'underline' : undefined,
            }}
            title={isMapFocused ? '点击取消聚焦' : '点击聚焦到地图'}
          >
            {record.focused ? <Tag color="blue">⭐ {v}</Tag> : v}
          </span>
        )
      },
      sorter: (a: any, b: any) => a.city.localeCompare(b.city, 'zh'),
    },
    {
      title: '环比',
      dataIndex: 'hb',
      key: 'hb',
      sorter: (a: any, b: any) => a.hb - b.hb,
      render: (v: number) => (
        <span style={{ color: v >= 100 ? '#ef4444' : '#22c55e' }}>
          {v >= 100 ? '+' : ''}{(v - 100).toFixed(1)}%
        </span>
      ),
    },
    {
      title: '同比',
      dataIndex: 'tb',
      key: 'tb',
      sorter: (a: any, b: any) => a.tb - b.tb,
      render: (v: number) => (
        <span style={{ color: v >= 100 ? '#ef4444' : '#22c55e' }}>
          {v >= 100 ? '+' : ''}{(v - 100).toFixed(1)}%
        </span>
      ),
    },
    {
      title: '定基',
      dataIndex: 'dj',
      key: 'dj',
      sorter: (a: any, b: any) => a.dj - b.dj,
      render: (v: number) => (
        <span style={{ color: v >= 100 ? '#ef4444' : '#22c55e' }}>
          {v >= 100 ? '+' : ''}{(v - 100).toFixed(1)}%
        </span>
      ),
    },
  ]

  return (
    <Table
      dataSource={dataSource}
      columns={columns}
      size="small"
      pagination={false}
      className="sticky-table"
      style={{ fontSize: 12 }}
      rowClassName={(record) => record.city === mapFocusCity ? 'table-row-map-focused' : ''}
    />
  )
}
