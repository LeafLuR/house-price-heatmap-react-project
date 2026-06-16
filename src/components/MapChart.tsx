import { useRef, useEffect, useMemo } from 'react'
import * as echarts from 'echarts'
import type { MonthEntry, HouseType, Metric } from '../types'
import { aggregateToProvince, getMonthCities, CITY_PROVINCE } from '../utils/dataLoader'

interface Props {
  entry: MonthEntry | null
  houseType: HouseType
  metric: Metric
  chinaGeo: any
  focusCities: string[]
  /** 需要在地图上聚焦的省份名 */
  focusProvince?: string | null
}

/** 指标 → 聚合数据字段映射 */
const METRIC_KEY: Record<Metric, 'hb' | 'tb' | 'dj'> = {
  环比: 'hb',
  同比: 'tb',
  定基: 'dj',
}

/** 色阶：绿(跌) → 黄(平) → 红(涨) */
const COLOR_RANGE = ['#2c6e49', '#8cb369', '#f4e285', '#f4a259', '#bc4a51']

export default function MapChart({
  entry,
  houseType,
  metric,
  chinaGeo,
  focusCities,
  focusProvince,
}: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  // 初始化 ECharts 实例 + ResizeObserver 自适应
  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current, undefined, { renderer: 'canvas' })
    instanceRef.current = instance

    const ro = new ResizeObserver(() => instance.resize())
    ro.observe(chartRef.current)

    return () => {
      ro.disconnect()
      instance.dispose()
      instanceRef.current = null
    }
  }, [])

  // 聚合省份数据
  const provinceData = useMemo(() => {
    if (!entry) return []
    return aggregateToProvince(entry, houseType)
  }, [entry, houseType])

  // 省份 → 城市明细（供 tooltip 展示）
  const provinceCityDetail = useMemo(() => {
    if (!entry) return {}
    const cities = getMonthCities(entry, houseType)
    const map: Record<string, Array<{ city: string; hb: number; tb: number; dj: number }>> = {}
    for (const c of cities) {
      const prov = CITY_PROVINCE[c.city]
      if (!prov) continue
      if (!map[prov]) map[prov] = []
      map[prov].push(c)
    }
    return map
  }, [entry, houseType])

  // 主渲染 + 聚焦
  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !entry || !chinaGeo) return

    const key = METRIC_KEY[metric]

    // 关注省份
    const focusProvinces = new Set(
      focusCities.map(c => CITY_PROVINCE[c]).filter(Boolean)
    )

    // 地图数据（每省附加样式）
    const mapData = provinceData.map(p => {
      let itemStyle: any = undefined
      if (p.name === focusProvince) {
        // 点击聚焦的省份 — 显眼高亮
        itemStyle = {
          borderColor: '#ff4d4f',
          borderWidth: 3,
          shadowBlur: 14,
          shadowColor: 'rgba(255,77,79,0.5)',
          areaColor: undefined, // 保留色阶着色
        }
      } else if (focusProvinces.has(p.name)) {
        // 关注城市所在省份 — 蓝色边框
        itemStyle = {
          borderColor: '#1890ff',
          borderWidth: 2.5,
          shadowBlur: 8,
          shadowColor: 'rgba(24,144,255,0.35)',
        }
      }
      return {
        name: p.name,
        value: +(p[key] - 100).toFixed(2),
        itemStyle,
      }
    })

    // 动态 visualMap 范围
    const values = mapData.map(d => d.value).sort((a, b) => a - b)
    const lo = values[Math.floor(values.length * 0.05)] ?? -2
    const hi = values[Math.floor(values.length * 0.95)] ?? 2
    const absMax = Math.max(Math.abs(lo), Math.abs(hi), 1)
    const vMin = -absMax
    const vMax = absMax

    // 聚焦省份 → 取中心坐标 + 放大
    const geoFeature = focusProvince
      ? chinaGeo.features.find((f: any) => f.properties.name === focusProvince)
      : null

    const seriesCenter = geoFeature?.properties?.center ?? undefined
    const seriesZoom = geoFeature ? 3 : undefined

    // 注册地图
    echarts.registerMap('china', chinaGeo)

    instance.setOption(
      {
        tooltip: {
          trigger: 'item',
          formatter: (params: any) => {
            const provName = params.name as string
            const cities = provinceCityDetail[provName]
            if (params.value === undefined || params.value === null) {
              return `<b>${provName}</b><br/>无数据`
            }
            const sign = params.value >= 0 ? '+' : ''
            let html = `<b>${provName}</b>  ${metric}: <b>${sign}${params.value.toFixed(2)}%</b>`
            if (cities && cities.length > 0) {
              html += '<hr style="margin:4px 0;border:none;border-top:1px solid #e8e8e8"/>'
              const key = METRIC_KEY[metric]
              cities.sort((a, b) => (b as any)[key] - (a as any)[key])
              for (const c of cities) {
                const v = (c as any)[key] - 100
                const cs = v >= 0 ? '+' : ''
                const color = v >= 0 ? '#ef4444' : '#22c55e'
                html += `<br/>${c.city}: <span style="color:${color}">${cs}${v.toFixed(2)}%</span>`
              }
            }
            return html
          },
        },
        visualMap: {
          min: vMin,
          max: vMax,
          inRange: { color: COLOR_RANGE },
          text: [`${vMax >= 0 ? '+' : ''}${vMax.toFixed(1)}%`, `${vMin >= 0 ? '+' : ''}${vMin.toFixed(1)}%`],
          textStyle: { color: '#666', fontSize: 11 },
          calculable: true,
          orient: 'horizontal',
          left: 'center',
          bottom: 8,
        },
        series: [
          {
            type: 'map',
            map: 'china',
            roam: true,
            scaleLimit: { min: geoFeature ? 1 : 1, max: 8 },
            center: seriesCenter,
            zoom: seriesZoom,
            selectedMode: false,
            label: {
              show: true,
              fontSize: 10,
              color: '#333',
            },
            emphasis: {
              label: { color: '#fff', fontSize: 13 },
              itemStyle: { areaColor: '#ff6b6b' },
            },
            data: mapData,
            itemStyle: {
              borderColor: '#ccc',
              borderWidth: 0.5,
              areaColor: '#f0f0f0',
            },
          },
        ],
      },
      true
    )
  }, [entry, houseType, metric, chinaGeo, provinceData, provinceCityDetail, focusCities, focusProvince])

  return (
    <div
      ref={chartRef}
      style={{ width: '100%', height: '100%', minHeight: 0 }}
    />
  )
}
