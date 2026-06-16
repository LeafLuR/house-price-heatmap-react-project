import { Layout, Typography, Grid } from 'antd'

const { Header: AntHeader } = Layout
const { useBreakpoint } = Grid

export default function AppHeader() {
  const screens = useBreakpoint()
  const isMobile = !screens.md

  return (
    <AntHeader
      style={{
        background: '#fff',
        padding: isMobile ? '0 10px' : '0 16px',
        display: 'flex',
        alignItems: 'center',
        height: isMobile ? 38 : 44,
        borderBottom: '1px solid #e8e8e8',
        lineHeight: isMobile ? '38px' : '44px',
      }}
    >
      <span
        style={{
          display: 'inline-block',
          width: isMobile ? 6 : 8,
          height: isMobile ? 6 : 8,
          borderRadius: 2,
          background: '#1677ff',
          marginRight: isMobile ? 6 : 10,
          flexShrink: 0,
        }}
      />
      <Typography.Text strong style={{ fontSize: isMobile ? 14 : 15, color: '#1a1a2e' }}>
        70城房价数据大屏
      </Typography.Text>
      {!isMobile && (
        <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 12 }}>
          国家统计局 · 环比/同比/定基
        </Typography.Text>
      )}
    </AntHeader>
  )
}
