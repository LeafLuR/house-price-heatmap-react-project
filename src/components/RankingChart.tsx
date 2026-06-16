import { useRef, useEffect } from 'react'
import * as echarts from 'echarts'
import type { MonthEntry, HouseType, Metric } from '../types'
import { getMonthRanking } from '../utils/dataLoader'

interface Props {
  entry: MonthEntry | null
  houseType: HouseType
  metric: Metric
  topN?: number
}

export default function RankingChart({ entry, houseType, metric, topN = 15 }: Props) {
  const chartRef = useRef<HTMLDivElement>(null)
  const instanceRef = useRef<echarts.ECharts | null>(null)

  useEffect(() => {
    if (!chartRef.current) return
    const instance = echarts.init(chartRef.current)
    instanceRef.current = instance
    return () => {
      instance.dispose()
      instanceRef.current = null
    }
  }, [])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || !entry) return

    const ranking = getMonthRanking(entry, houseType, metric).slice(0, topN)
    const cities = ranking.map(r => r.city).reverse()
    const values = ranking.map(r => +(r.value - 100).toFixed(1)).reverse()
    const colors = values.map(v => (v >= 0 ? '#ef4444' : '#22c55e'))

    instance.setOption({
      tooltip: {
        trigger: 'axis',
        axisPointer: { type: 'shadow' },
        formatter: (params: any) => {
          const p = params[0]
          return `${p.axisValue}<br/>${metric}: ${p.value >= 0 ? '+' : ''}${p.value}%`
        },
      },
      grid: { left: 80, right: 30, top: 10, bottom: 10 },
      xAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
      },
      yAxis: {
        type: 'category',
        data: cities,
        axisLabel: { fontSize: 11 },
      },
      series: [
        {
          type: 'bar',
          data: values.map((v, i) => ({
            value: v,
            itemStyle: { color: colors[i], borderRadius: [0, 3, 3, 0] },
          })),
          barMaxWidth: 20,
          label: {
            show: true,
            position: 'right',
            formatter: (p: any) => `${p.value >= 0 ? '+' : ''}${p.value}%`,
            fontSize: 10,
          },
        },
      ],
    })
  }, [entry, houseType, metric, topN])

  return <div ref={chartRef} style={{ width: '100%', height: 400 }} />
}
