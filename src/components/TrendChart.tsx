import { useRef, useEffect, useMemo } from 'react'
import * as echarts from 'echarts'
import type { MonthEntry, HouseType } from '../types'
import { calcCumulativeIndex } from '../utils/dataLoader'

interface Props {
  entries: Record<string, MonthEntry>
  months: string[]
  houseType: HouseType
  focusCities: string[]
  /** 当前月份 — 在图表上画出竖线标记 */
  currentMonth?: string
}

const COLORS = [
  '#fbbf24', '#22c55e', '#ef4444', '#3b82f6', '#a78bfa',
  '#f472b6', '#34d399', '#f97316', '#14b8a6', '#e879f9',
]

export default function TrendChart({ entries, months, houseType, focusCities, currentMonth }: Props) {
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

  const series = useMemo(() => {
    const lines = focusCities.map((city, i) => {
      const data = calcCumulativeIndex(entries, months, city, houseType)
      return {
        name: city,
        type: 'line' as const,
        smooth: true,
        symbol: 'none',
        lineStyle: { width: 2 },
        data: data.map(d => +(d.index * 100 - 100).toFixed(2)),
        itemStyle: { color: COLORS[i % COLORS.length] },
      }
    })
    // 给第一条折线加时间标记竖线
    if (lines.length > 0 && currentMonth) {
      lines[0] = {
        ...lines[0],
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#ff4d4f', type: 'dashed', width: 1.5 },
          data: [{ xAxis: currentMonth }],
          label: { show: false },
        },
      } as typeof lines[0]
    }
    return lines
  }, [entries, months, houseType, focusCities, currentMonth])

  useEffect(() => {
    const instance = instanceRef.current
    if (!instance || series.length === 0) return

    instance.setOption({
      tooltip: {
        trigger: 'axis',
        formatter: (params: any[]) => {
          let html = `<b>${params[0].axisValue}</b><br/>`
          params.forEach((p: any) => {
            html += `${p.marker} ${p.seriesName}: ${p.value >= 0 ? '+' : ''}${p.value.toFixed(2)}%<br/>`
          })
          return html
        },
      },
      legend: {
        data: focusCities,
        type: 'scroll',
        bottom: 0,
        textStyle: { fontSize: 11 },
      },
      grid: { left: 50, right: 20, top: 20, bottom: 65 },
      xAxis: {
        type: 'category',
        data: months,
        axisLabel: { rotate: 45, fontSize: 9, interval: 11 },
      },
      yAxis: {
        type: 'value',
        axisLabel: { formatter: '{value}%' },
        splitLine: { lineStyle: { type: 'dashed', color: '#eee' } },
      },
      series,
    })
  }, [series, months, focusCities, currentMonth])

  return <div ref={chartRef} style={{ width: '100%', height: 240 }} />
}
