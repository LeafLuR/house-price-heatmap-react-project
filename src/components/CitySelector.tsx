import { useMemo } from 'react'
import { Select, Tag, Space, Typography } from 'antd'
import { CITY_NAMES } from '../types'

const { Text } = Typography

interface Props {
  selectedCities: string[]
  onChange: (cities: string[]) => void
}

export default function CitySelector({ selectedCities, onChange }: Props) {
  const options = useMemo(() => {
    return CITY_NAMES.map(c => ({
      value: c,
      label: c,
      disabled: selectedCities.includes(c),
    }))
  }, [selectedCities])

  return (
    <div>
      <Text strong style={{ fontSize: 12, display: 'block', marginBottom: 4 }}>
        添加关注城市（点击 Tag 移除）
      </Text>
      <div style={{ marginBottom: 8 }}>
        {selectedCities.length === 0 ? (
          <Text type="secondary">未选择城市</Text>
        ) : (
          <Space wrap size={[4, 4]}>
            {selectedCities.map(city => (
              <Tag
                key={city}
                closable
                color="blue"
                onClose={() => onChange(selectedCities.filter(c => c !== city))}
              >
                {city}
              </Tag>
            ))}
          </Space>
        )}
      </div>
      <Select
        showSearch
        value={undefined}
        placeholder="搜索并添加城市..."
        style={{ width: '100%' }}
        options={options}
        onChange={(city) => {
          if (city && !selectedCities.includes(city)) {
            onChange([...selectedCities, city])
          }
        }}
        filterOption={(input, option) =>
          (option?.label as string)?.includes(input) ?? false
        }
        listHeight={300}
      />
    </div>
  )
}
