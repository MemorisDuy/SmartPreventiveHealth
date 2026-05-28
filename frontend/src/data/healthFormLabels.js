/** Nhãn tiếng Việt cho form & payload AI */
export const AGE_GROUP_LABELS = {
  1: '18–24 tuổi',
  2: '25–29 tuổi',
  3: '30–34 tuổi',
  4: '35–39 tuổi',
  5: '40–44 tuổi',
  6: '45–49 tuổi',
  7: '50–54 tuổi',
  8: '55–59 tuổi',
  9: '60–64 tuổi',
  10: '65–69 tuổi',
  11: '70–74 tuổi',
  12: '75–79 tuổi',
  13: '80+ tuổi',
}

export function formatHealthDataForAi(raw) {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  return {
    'Huyết áp cao': raw.HighBP === 1 ? 'Có' : 'Không',
    'Cholesterol cao': raw.HighChol === 1 ? 'Có' : 'Không',
    'Chỉ số BMI': raw.BMI,
    'Hút thuốc': raw.Smoker === 1 ? 'Có' : 'Không',
    'Tiểu đường':
      raw.Diabetes === 2
        ? 'Có đái tháo đường'
        : raw.Diabetes === 1
          ? 'Tiền đái tháo đường'
          : 'Không',
    'Vận động (30 ngày qua)': raw.PhysActivity === 1 ? 'Có' : 'Không',
    'Ăn trái cây hàng ngày': raw.Fruits === 1 ? 'Có' : 'Không',
    'Ăn rau hàng ngày': raw.Veggies === 1 ? 'Có' : 'Không',
    'Uống rượu nhiều': raw.HvyAlcoholConsump === 1 ? 'Có' : 'Không',
    'Nhóm tuổi': AGE_GROUP_LABELS[raw.Age] || `Mã nhóm ${raw.Age}`,
    'Giới tính': raw.Sex === 1 ? 'Nam' : 'Nữ',
  }
}

export function getRiskTier(percentage) {
  const value = Number(percentage)
  if (Number.isNaN(value)) {
    return 'unknown'
  }
  if (value < 30) {
    return 'low'
  }
  if (value < 70) {
    return 'medium'
  }
  return 'high'
}
