import { useState, useEffect, useRef } from 'react'
import { Layout, Space, Radio, Slider, Button, Row, Col, Spin, Card, Grid } from 'antd'
import { PlayCircleOutlined, PauseCircleOutlined } from '@ant-design/icons'
import AppHeader from './components/AppHeader'
import MapChart from './components/MapChart'
import TrendChart from './components/TrendChart'
import RankingChart from './components/RankingChart'
import DataTable from './components/DataTable'
import CitySelector from './components/CitySelector'
import { loadHistoricalData, loadChinaGeo, CITY_PROVINCE } from './utils/dataLoader'
import type { HouseType, Metric, MonthEntry } from './types'

const { Content, Sider } = Layout
const { useBreakpoint } = Grid

export default function App() {
  const [loading, setLoading] = useState(true)
  const [months, setMonths] = useState<string[]>([])
  const [entries, setEntries] = useState<Record<string, MonthEntry>>({})
  const [chinaGeo, setChinaGeo] = useState<any>(null)
  const [monthIdx, setMonthIdx] = useState(0)
  const [houseType, setHouseType] = useState<HouseType>('new_house')
  const [metric, setMetric] = useState<Metric>('环比')
  const [focusCities, setFocusCities] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem('heatmap-focus-cities')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
      }
    } catch { /* ignore */ }
    return ['杭州', '大连', '哈尔滨', '厦门']
  })
  const [isPlaying, setIsPlaying] = useState(false)
  const [mapFocusCity, setMapFocusCity] = useState<string | null>(null)
  const playRef = useRef<number | null>(null)
  const mapContainerRef = useRef<HTMLDivElement>(null)

  const screens = useBreakpoint()
  const isMobile = !screens.md

  // 点击数据列表城市 → 聚焦地图省份（再次点击同一城市取消聚焦）
  const handleCityClick = (city: string) => {
    setMapFocusCity(prev => (prev === city ? null : city))
    // 移动端自动滚动到地图
    if (isMobile && mapContainerRef.current) {
      mapContainerRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const focusProvince = mapFocusCity ? CITY_PROVINCE[mapFocusCity] ?? null : null

  useEffect(() => {
    Promise.all([loadHistoricalData(), loadChinaGeo()])
      .then(([data, geo]) => {
        setMonths(data.months)
        setEntries(data.entries)
        setMonthIdx(data.months.length - 1)
        setChinaGeo(geo)
        setLoading(false)
      })
      .catch((err) => {
        console.error('数据加载失败:', err)
        setLoading(false)
      })
  }, [])

  // 关注城市持久化到 localStorage
  useEffect(() => {
    localStorage.setItem('heatmap-focus-cities', JSON.stringify(focusCities))
  }, [focusCities])

  // Play timer
  useEffect(() => {
    if (isPlaying) {
      playRef.current = window.setInterval(() => {
        setMonthIdx(prev => (prev + 1 >= months.length ? 0 : prev + 1))
      }, 800)
    } else {
      if (playRef.current) clearInterval(playRef.current)
    }
    return () => {
      if (playRef.current) clearInterval(playRef.current)
    }
  }, [isPlaying, months.length])

  const currentMonth = months[monthIdx]
  const currentEntry = currentMonth ? entries[currentMonth] : null

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="加载数据中..." />
      </div>
    )
  }

  // ==================== 共享子组件 ====================
  const controls = (
    <Space size={isMobile ? 8 : 8} wrap>
      <div>
        <div style={{ marginBottom: 2, fontSize: 11, color: '#999' }}>房屋类型</div>
        <Radio.Group value={houseType} onChange={e => setHouseType(e.target.value)} size="small">
          <Radio.Button value="new_house">新房</Radio.Button>
          <Radio.Button value="second_hand">二手房</Radio.Button>
        </Radio.Group>
      </div>
      <div>
        <div style={{ marginBottom: 2, fontSize: 11, color: '#999' }}>指标</div>
        <Radio.Group value={metric} onChange={e => setMetric(e.target.value)} size="small">
          <Radio.Button value="环比">环比</Radio.Button>
          <Radio.Button value="同比">同比</Radio.Button>
          <Radio.Button value="定基">定基</Radio.Button>
        </Radio.Group>
      </div>
    </Space>
  )

  const timeSlider = (
    <Card size="small" title={isMobile ? `${currentMonth}` : `时间: ${currentMonth}`}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Slider
          min={0}
          max={months.length - 1}
          value={monthIdx}
          onChange={setMonthIdx}
          style={{ flex: 1, margin: 0 }}
          tooltip={{ formatter: (v) => months[v!] }}
        />
        <Button
          type="text"
          icon={isPlaying ? <PauseCircleOutlined /> : <PlayCircleOutlined />}
          onClick={() => setIsPlaying(!isPlaying)}
          size="small"
        />
      </div>
    </Card>
  )

  const trendCard = (
    <Card size="small" title="累计指数走势">
      <TrendChart entries={entries} months={months} houseType={houseType} focusCities={focusCities} currentMonth={currentMonth} />
    </Card>
  )

  const mapCard = (flexHeight: boolean) => (
    <Card
      size="small"
      title="中国热力图"
      style={
        flexHeight
          ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 300 }
          : { display: 'flex', flexDirection: 'column', height: isMobile ? '60vh' : 400 }
      }
      styles={{
        body: {
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
          padding: '6px 10px',
          overflow: 'hidden',
        },
      }}
    >
      <div ref={mapContainerRef} style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        <MapChart entry={currentEntry} houseType={houseType} metric={metric} chinaGeo={chinaGeo} focusCities={focusCities} focusProvince={focusProvince} />
      </div>
    </Card>
  )

  const tableCard = (flexHeight: boolean) => (
    <Card
      size="small"
      title="数据列表"
      style={flexHeight ? { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 } : undefined}
      styles={{ body: { flex: 1, overflow: 'auto', minHeight: 0, padding: '6px 10px' } }}
    >
      <DataTable entry={currentEntry} houseType={houseType} metric={metric} focusCities={focusCities} onCityClick={handleCityClick} mapFocusCity={mapFocusCity} />
    </Card>
  )

  // ==================== Desktop Layout ====================
  if (!isMobile) {
    return (
      <Layout style={{ height: '100vh', background: '#f5f7fa' }}>
        <AppHeader />
        <Layout style={{ padding: 10, gap: 10, flex: 1, overflow: 'hidden' }}>
          <Sider width={280} style={{ background: 'transparent', overflow: 'hidden' }}>
            <div style={{ height: '100%', overflowY: 'auto', paddingRight: 2 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
                <Card size="small" title="控制面板">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
                    {controls}
                  </div>
                </Card>

                <Card size="small" title="城市选择">
                  <CitySelector selectedCities={focusCities} onChange={setFocusCities} />
                </Card>

                {timeSlider}

                <Card size="small" title="排名 (Top 15)">
                  <RankingChart entry={currentEntry} houseType={houseType} metric={metric} />
                </Card>
              </div>
            </div>
          </Sider>

          <Content style={{ background: 'transparent', display: 'flex', flexDirection: 'column', gap: 10, overflow: 'hidden' }}>
            {trendCard}
            <Row gutter={10} style={{ flex: 1, minHeight: 0 }}>
              <Col span={16} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {mapCard(true)}
              </Col>
              <Col span={8} style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                {tableCard(true)}
              </Col>
            </Row>
          </Content>
        </Layout>
      </Layout>
    )
  }

  // ==================== Mobile Layout ====================
  return (
    <Layout style={{ minHeight: '100vh', background: '#f5f7fa' }}>
      <AppHeader />
      <div style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
        {/* 控制面板 + 时间滑块 合并 */}
        <Card size="small">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%' }}>
            {controls}
            {timeSlider}
          </div>
        </Card>

        {/* 城市选择 */}
        <Card size="small" title="关注城市">
          <CitySelector selectedCities={focusCities} onChange={setFocusCities} />
        </Card>

        {/* 地图 占 55vh */}
        {mapCard(false)}

        {/* 走势图 */}
        {trendCard}

        {/* 数据列表 */}
        {tableCard(false)}
      </div>
    </Layout>
  )
}
