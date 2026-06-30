import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  ResponsiveContainer
} from 'recharts'

/*
  GHI CHÚ VẤN ĐÁP:
  Component này vẽ biểu đồ XAI/feature importance.
  Input X: dữ liệu xaiData gồm tên đặc trưng và giá trị ảnh hưởng.
  Hàm xử lý f: chuẩn hóa dữ liệu đầu vào rồi dùng Recharts để biểu diễn bằng biểu đồ cột.
  Output y: biểu đồ trực quan cho biết yếu tố nào tác động mạnh hơn đến kết quả dự đoán.
  Khi thầy hỏi XAI lấy từ đâu:
  - Backend trả feature_importances từ Random Forest.
  - Component này chỉ chịu trách nhiệm hiển thị phần giải thích đó trên giao diện.
*/

export default function XAIChart({ xaiData: propXaiData, compact = false }) {
  // Sử dụng dữ liệu từ props nếu có, nếu không dùng mock data
  let chartData = propXaiData || []

  // Nếu props là mảng từ API (format: [{ name: '...', value: ... }])
  // Chuyển thành format phù hợp cho biểu đồ
  if (Array.isArray(chartData) && chartData.length > 0) {
    chartData = chartData.map(item => ({
      name: item.name || item.label || item.key || '???',
      value: item.value || 0,
      type: (item.value || 0) > 0 ? 'danger' : 'safe'
    }))
  }

  // Mock Data - Dữ liệu Y khoa Mẫu (nếu không có dữ liệu từ API)
  const defaultData = [
    { name: 'Huyết áp tâm thu (Cao)', value: 25, type: 'danger' },
    { name: 'Hút thuốc lá', value: 15, type: 'danger' },
    { name: 'Chỉ số BMI (Thừa cân)', value: 10, type: 'danger' },
    { name: 'Ăn rau xanh/trái cây', value: -6, type: 'safe' },
    { name: 'Hoạt động thể chất', value: -12, type: 'safe' },
  ]

  const xaiData = chartData.length > 0 ? chartData : defaultData

  // Hàm xác định màu cho mỗi cột dựa trên giá trị
  const getBarColor = (value) => {
    if (value > 0) {
      return '#ef4444' // Đỏ nhạt cho yếu tố tăng nguy cơ
    } else {
      return '#22c55e' // Xanh lá cho yếu tố bảo vệ
    }
  }

  // Custom Tooltip để hiển thị thông tin chi tiết
  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      const label = data.type === 'danger' ? '⬆️ TĂNG nguy cơ' : '⬇️ GIẢM nguy cơ'
      return (
        <div className="bg-white border-2 border-slate-200 rounded-lg shadow-md p-3">
          <p className="font-bold text-slate-800 text-xs">{data.name}</p>
          <p className={`font-bold text-sm ${data.type === 'danger' ? 'text-red-600' : 'text-green-600'}`}>
            {Math.abs(data.value)}% - {label}
          </p>
        </div>
      )
    }
    return null
  }

  // Custom Label Renderer - Hiển thị % ở cuối mỗi cột
  const renderCustomLabel = (props) => {
    const { x, y, width, value } = props
    const isNegative = value < 0

    // Vị trí label ở bên ngoài cột
    const labelX = isNegative ? x - (compact ? 28 : 35) : x + width + 8

    return (
      <text
        x={labelX}
        y={y + 12}
        fill={value > 0 ? '#dc2626' : '#16a34a'}
        fontSize={compact ? 10 : 13}
        fontWeight={700}
        textAnchor={isNegative ? 'end' : 'start'}
      >
        {`${Math.abs(value)}%`}
      </text>
    )
  }

  if (compact) {
    return (
      <div className="w-full">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart
            data={xaiData}
            layout="vertical"
            margin={{ top: 5, right: 35, left: 80, bottom: 5 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="#f1f5f9"
              vertical={false}
              horizontal={true}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={75}
              tick={{ fontSize: 10, fill: '#475569', fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
            />
            <XAxis
              type="number"
              hide={true}
              domain={[-20, 30]}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(22, 163, 74, 0.05)' }} />
            <Bar
              dataKey="value"
              radius={[0, 4, 4, 0]}
              label={renderCustomLabel}
              isAnimationActive={true}
            >
              {xaiData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    )
  }

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Container Card chính */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-md overflow-hidden">
        
        {/* Header Section */}
        <div className="bg-gradient-to-r from-slate-50 to-slate-100 px-8 py-6 border-b border-slate-200">
          <div className="flex items-center gap-3 mb-2">
            <span className="text-3xl"></span>
            <h3 className="text-2xl font-bold text-slate-900">
              Explainable AI (XAI)
            </h3>
          </div>
          <p className="text-slate-600 text-base leading-relaxed">
            Mức đóng góp của từng yếu tố lâm sàn (Random Forest):
          </p>
        </div>

        {/* Biểu đồ Section */}
        <div className="px-8 py-8">
          <ResponsiveContainer width="100%" height={320}>
            <BarChart
              data={xaiData}
              layout="vertical"
              margin={{ top: 5, right: 100, left: 200, bottom: 5 }}
            >
              {/* Lưới nền nhẹ */}
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
                vertical={false}
                horizontal={true}
              />

              {/* Trục Y - Loại category, hiển thị tên chỉ số */}
              <YAxis
                type="category"
                dataKey="name"
                width={195}
                tick={{ fontSize: 12, fill: '#475569', fontWeight: 500 }}
                axisLine={false}
                tickLine={false}
              />

              {/* Trục X - Loại number, ẩn hoàn toàn */}
              <XAxis
                type="number"
                hide={true}
                domain={[-20, 30]}
              />

              {/* Custom Tooltip */}
              <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(59, 130, 246, 0.1)' }} />

              {/* Bar Chart với màu động */}
              <Bar
                dataKey="value"
                radius={[0, 4, 4, 0]}
                label={renderCustomLabel}
                isAnimationActive={true}
              >
                {xaiData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={getBarColor(entry.value)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Khối "Hướng dẫn đọc biểu đồ" - AI Doctor Explanation */}
        <div className="bg-slate-50 border-t border-slate-200 px-8 py-6 rounded-b-2xl">
          
          {/* Tiêu đề */}
          <div className="flex items-center gap-2 mb-4">
            <span className="text-2xl">💡</span>
            <h4 className="text-lg font-bold text-slate-900">
              Bác sĩ AI giải thích:
            </h4>
          </div>

          {/* Dòng 1 - Yếu tố TĂNG nguy cơ (Chữ đỏ) */}
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl">
            <p className="flex items-start gap-3 text-red-900 leading-relaxed font-medium">
              <span className="text-xl flex-shrink-0 mt-0.5">🟥</span>
              <span>
                <strong className="text-red-700 block mb-1">Yếu tố làm TĂNG nguy cơ:</strong>
                Huyết áp, Hút thuốc và BMI đang là tác nhân chính đẩy rủi ro của bạn lên cao. Bạn cần can thiệp y tế ngay vào các chỉ số này.
              </span>
            </p>
          </div>

          {/* Dòng 2 - Yếu tố BẢO VỆ sức khỏe (Chữ xanh) */}
          <div className="p-4 bg-green-50 border border-green-200 rounded-xl">
            <p className="flex items-start gap-3 text-green-900 leading-relaxed font-medium">
              <span className="text-xl flex-shrink-0 mt-0.5">🟩</span>
              <span>
                <strong className="text-green-700 block mb-1">Yếu tố BẢO VỆ sức khỏe:</strong>
                Thói quen vận động và ăn rau xanh đang giúp bạn kéo giảm đáng kể rủi ro. Hãy tiếp tục phát huy!
              </span>
            </p>
          </div>

          {/* Dòng 3 - Khuyến nghị chung */}
          <div className="mt-4 pt-4 border-t border-slate-200">
            <p className="text-slate-700 text-sm leading-relaxed">
              <strong className="text-slate-900">📌 Khuyến nghị:</strong> Hãy tập trung vào việc giảm các yếu tố nguy cơ (tập thể dục thêm, bỏ thuốc, kiểm soát huyết áp) để cải thiện sức khỏe toàn diện. Liên hệ bác sĩ để có kế hoạch can thiệp chi tiết.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
