import React, { useEffect, useState } from 'react'
import api from '../api/axios'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này hiển thị lịch sử tầm soát sức khỏe của từng người dùng.
  Input X: user_id của người dùng đang đăng nhập.
  Hàm xử lý f: gọi API /api/history/{user_id}, backend query bảng health_records trong MySQL.
  Output y: danh sách các lần tầm soát gần nhất, gồm input sức khỏe, phần trăm nguy cơ,
  mức nguy cơ và trạng thái bất thường.
  Ý nghĩa:
  - Giúp người dùng theo dõi xu hướng sức khỏe theo thời gian.
  - Chứng minh hệ thống có lưu trữ dữ liệu sau mỗi lần dự đoán, không chỉ xử lý tức thời.
*/

export default function HistoryPage() {
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : {}
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [stats, setStats] = useState({
    avgRisk: 0,
    maxRisk: 0,
    minRisk: 0,
    totalRecords: 0,
  })

  useEffect(() => {
    fetchHistory()
  }, [])

  const fetchHistory = async () => {
    try {
      const response = await api.get(`/api/history/${user.user_id}`)
      const data = response.data || []

      const formatted = data.map((d) => ({
        date: new Date(d.created_at).toLocaleDateString('vi-VN', {
          month: '2-digit',
          day: '2-digit',
          year: '2-digit',
        }),
        risk: parseFloat(
          d.ai_risk_prediction ? d.ai_risk_prediction.toFixed(2) : d.risk_percentage || 0
        ),
        record: d,
      }))

      setRecords(formatted)

      if (formatted.length > 0) {
        const risks = formatted.map((r) => r.risk).filter((r) => !isNaN(r))
        setStats({
          avgRisk: risks.length ? (risks.reduce((a, b) => a + b, 0) / risks.length).toFixed(2) : 0,
          maxRisk: risks.length ? Math.max(...risks).toFixed(2) : 0,
          minRisk: risks.length ? Math.min(...risks).toFixed(2) : 0,
          totalRecords: formatted.length,
        })
      }

      setLoading(false)
    } catch (err) {
      console.error('Error fetching history:', err)
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh]">
        <div className="w-10 h-10 border-3 border-brand-200 border-t-brand-600 rounded-full animate-spin mb-4" />
        <p className="text-lg text-brand-700 font-medium">Đang tải lịch sử...</p>
      </div>
    )
  }

  const feature = getFeatureById('history')
  const anomalyFeature = getFeatureById('anomaly')
  const anomalyCount = records.filter((r) => r.record?.is_anomaly).length

  if (records.length === 0) {
    return (
      <div className="animate-fade-in space-y-6">
        <FeaturePageBanner feature={feature} />
        <PageHeader
          title="Lịch sử sức khỏe"
          description="Theo dõi tiến trình qua từng lần tầm soát."
        />
        <div className="section-card text-center py-12 mt-8">
          <h2 className="text-2xl font-bold mb-3">Chưa có dữ liệu</h2>
          <p className="text-slate-600 text-lg max-w-md mx-auto leading-relaxed">
            Hãy thực hiện tầm soát rủi ro để bắt đầu theo dõi biểu đồ sức khỏe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <FeaturePageBanner feature={feature} />
      <PageHeader
        title="Tiến trình sức khỏe"
        description="Line Chart theo dõi rủi ro — kèm cảnh báo Isolation Forest khi có điểm dị thường."
      />

      {anomalyCount > 0 && (
        <div className="alert-error">
          <strong>Cảnh báo dị thường ({anomalyCount} lần đo):</strong>{' '}
          {anomalyFeature?.description}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="stat-card border-b-4 border-b-slate-400">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Tổng lần đo</p>
          <p className="text-3xl font-extrabold text-slate-900 mt-1">{stats.totalRecords}</p>
        </div>
        <div className="stat-card border-b-4 border-b-brand-500">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Trung bình</p>
          <p className="text-3xl font-extrabold text-brand-600 mt-1">{stats.avgRisk}%</p>
        </div>
        <div className="stat-card border-b-4 border-b-red-500">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Cao nhất</p>
          <p className="text-3xl font-extrabold text-red-600 mt-1">{stats.maxRisk}%</p>
        </div>
        <div className="stat-card border-b-4 border-b-amber-400">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Thấp nhất</p>
          <p className="text-3xl font-extrabold text-amber-600 mt-1">{stats.minRisk}%</p>
        </div>
      </div>

      <div className="section-card">
        <h2 className="text-xl font-bold mb-6">Xu hướng rủi ro tim mạch & đột quỵ</h2>
        <div className="w-full h-[320px] sm:h-[400px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={records}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis dataKey="date" tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#64748b' }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0' }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="risk"
                name="Tỉ lệ nguy cơ (%)"
                stroke="#16a34a"
                strokeWidth={3}
                dot={{ r: 4, fill: '#fff', stroke: '#16a34a', strokeWidth: 2 }}
                activeDot={{ r: 6, fill: '#16a34a' }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="section-card">
        <h2 className="text-xl font-bold mb-4">Chi tiết lịch sử</h2>
        <div className="overflow-x-auto -mx-2">
          <table className="table-modern w-full min-w-[480px]">
            <thead>
              <tr>
                <th>Ngày đo</th>
                <th>Huyết áp</th>
                <th>Trạng thái</th>
                <th>Dị thường</th>
                <th>Tỉ lệ</th>
              </tr>
            </thead>
            <tbody>
              {records
                .slice()
                .reverse()
                .map((item, idx) => (
                  <tr key={idx}>
                    <td>{item.date}</td>
                    <td>{item.record.HighBP ? 'Có' : 'Bình thường'}</td>
                    <td>
                      <span
                        className={`inline-block px-3 py-1 rounded-full text-sm font-medium ${
                          item.record.risk_level === 'Thấp'
                            ? 'bg-brand-100 text-brand-800'
                            : item.record.risk_level === 'Trung bình'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {item.record.risk_level || '—'}
                      </span>
                    </td>
                    <td>
                      {item.record.is_anomaly ? (
                        <span className="inline-block px-2 py-1 rounded-lg text-xs font-bold bg-red-100 text-red-800">
                          Có
                        </span>
                      ) : (
                        <span className="text-slate-500 text-sm">Không</span>
                      )}
                    </td>
                    <td className="font-bold">{item.risk}%</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl bg-brand-50 border border-brand-200 p-6 sm:p-8">
        <h3 className="text-xl font-bold text-brand-900 mb-4">Lời khuyên duy trì sức khỏe</h3>
        <ul className="grid sm:grid-cols-2 gap-3 text-slate-700">
          {[
            'Kiểm tra sức khỏe định kỳ (1–2 lần/tháng)',
            'Tập thể dục đều đặn (30 phút/ngày)',
            'Ăn uống lành mạnh, tăng rau xanh',
            'Kiểm soát cân nặng hợp lý',
          ].map((tip) => (
            <li key={tip} className="flex gap-2">
              <span className="text-brand-600 font-bold">✓</span>
              {tip}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
