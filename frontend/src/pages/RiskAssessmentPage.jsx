import React, { useState, useEffect } from 'react'
import api from '../api/axios'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import ResultDashboard from '../components/ResultDashboard'
import { getFeatureById } from '../data/features'
import { AGE_GROUP_LABELS } from '../data/healthFormLabels'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này là module tầm soát nguy cơ tim mạch/đột quỵ bằng Machine Learning.
  Input X: 11 chỉ số sức khỏe gồm HighBP, HighChol, BMI, Smoker, Diabetes,
  PhysActivity, Fruits, Veggies, HvyAlcoholConsump, Age và Sex.
  Hàm xử lý f:
  - Frontend kiểm tra dữ liệu form, đặc biệt BMI.
  - Gửi dữ liệu đến backend /api/predict.
  - Backend dùng RandomForestClassifier để tính xác suất nguy cơ.
  Output y:
  - risk_percentage: phần trăm nguy cơ.
  - risk_level: Thấp / Trung bình / Cao.
  - is_anomaly: có bất thường dữ liệu hay không.
  - feature_importances: dữ liệu phục vụ XAI.
  Khi thầy hỏi y = f(X):
  - X là 11 chỉ số sức khỏe, f là Random Forest, y là phần trăm nguy cơ.
*/

const INITIAL_FORM = {
  HighBP: 0,
  HighChol: 0,
  BMI: 25,
  Smoker: 0,
  Diabetes: 0,
  PhysActivity: 1,
  Fruits: 1,
  Veggies: 1,
  HvyAlcoholConsump: 0,
  Age: 9,
  Sex: 0,
}

function BmiLabelWithTooltip() {
  return (
    <label className="label-field flex items-center gap-2">
      <span>Chỉ số BMI (10–60)</span>
      <span className="relative group inline-flex items-center">
        <span
          className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center cursor-help select-none"
          tabIndex={0}
          aria-label="Hướng dẫn tính BMI"
        >
          ?
        </span>
        <span
          role="tooltip"
          className="pointer-events-none absolute left-1/2 bottom-full z-20 mb-2 w-64 -translate-x-1/2 rounded-xl border border-slate-200 bg-slate-900 px-3 py-2 text-xs font-normal leading-relaxed text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"
        >
          Công thức: Cân nặng (kg) / [Chiều cao (m)]² hoặc có thể hỏi trực tiếp Bác sĩ AI
        </span>
      </span>
    </label>
  )
}

function isBmiInvalid(bmi) {
  const value = Number(bmi)
  if (Number.isNaN(value)) {
    return true
  }
  return value < 10 || value > 60
}

export default function RiskAssessmentPage() {
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : {}

  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState(null)
  const [submittedForm, setSubmittedForm] = useState(null)
  const [lastRecords, setLastRecords] = useState([])
  const [form, setForm] = useState(INITIAL_FORM)
  const [bmiTouched, setBmiTouched] = useState(false)

  const bmiInvalid = isBmiInvalid(form.BMI)
  const showBmiError = bmiTouched && bmiInvalid

  useEffect(() => {
    fetchLastRecords()
  }, [])

  const fetchLastRecords = async () => {
    try {
      const response = await api.get(`/api/history/${user.user_id}`)
      if (response.data) setLastRecords(response.data.slice(-3))
    } catch (err) {
      console.error('Error fetching records:', err)
    }
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    if (name === 'BMI') {
      setBmiTouched(true)
      const parsed = value === '' ? '' : parseFloat(value)
      setForm({
        ...form,
        BMI: parsed,
      })
      return
    }
    setForm({
      ...form,
      [name]: parseInt(value, 10),
    })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setBmiTouched(true)
    if (isBmiInvalid(form.BMI)) {
      return
    }

    setLoading(true)
    setResult(null)
    setSubmittedForm(null)

    const payload = {
      ...form,
      BMI: Number(form.BMI),
    }

    try {
      // Parse toàn bộ payload để đảm bảo kiểu dữ liệu chính xác (Sửa lỗi 422)
      const apiPayload = {
        user_id: parseInt(user.user_id, 10) || 0,
        HighBP: parseInt(payload.HighBP, 10) || 0,
        HighChol: parseInt(payload.HighChol, 10) || 0,
        BMI: parseFloat(payload.BMI) || 0.0,
        Smoker: parseInt(payload.Smoker, 10) || 0,
        Diabetes: parseInt(payload.Diabetes, 10) || 0,
        PhysActivity: parseInt(payload.PhysActivity, 10) || 0,
        Fruits: parseInt(payload.Fruits, 10) || 0,
        Veggies: parseInt(payload.Veggies, 10) || 0,
        HvyAlcoholConsump: parseInt(payload.HvyAlcoholConsump, 10) || 0,
        Age: parseInt(payload.Age, 10) || 0,
        Sex: parseInt(payload.Sex, 10) || 0,
      }

      // Validate dữ liệu trước khi gửi
      if (apiPayload.BMI < 10 || apiPayload.BMI > 60) {
        alert('Lỗi: BMI phải trong khoảng 10-60')
        setLoading(false)
        return
      }

      // Gọi API backend thực tế
      const response = await api.post('/api/predict', apiPayload)
      
      // Response đã có đúng format từ backend
      const transformedResult = {
        ...response.data,
        inputs: payload,
      }

      setResult(transformedResult)
      setSubmittedForm(payload)
      fetchLastRecords()
    } catch (err) {
      console.error('Error calling API:', err)
      // Sửa lỗi hiển thị error (Nhiệm vụ 1)
      const errorMessage = err.response?.data?.detail || err.message || 'Không thể phân tích'
      alert(`Lỗi API: ${errorMessage}`)
    } finally {
      setLoading(false)
    }
  }

  const feature = getFeatureById('risk')

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in">
      <FeaturePageBanner feature={feature} />
      <PageHeader
        title="Nhập 11 chỉ số y tế"
        description="Đây là 11 yếu tố thói quen sinh hoạt và chỉ số lâm sàn có ảnh hưởng trực tiếp nhất đến nguy cơ tim mạch và đột quỵ. Hãy điền trung thực các thông tin dưới đây để Trợ lý AI phân tích, đối chiếu với cơ sở dữ liệu y khoa và đưa ra phác đồ phòng ngừa dành riêng cho bạn."
      />

      <div className="section-card">
        <h2 className="text-xl font-bold mb-6 pb-4 border-b border-slate-100">
          Cập nhật chỉ số
        </h2>

        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5 mb-6">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xl">🩺</span>
            <h3 className="text-lg font-bold text-blue-800">
              Hướng dẫn Tầm soát nhanh
            </h3>
          </div>
          <ul className="space-y-2 text-sm text-blue-700">
            <li>
              <strong>Điền trung thực:</strong> Để AI dự đoán chính xác, vui lòng nhập đúng tình trạng thói quen sinh hoạt hiện tại của bạn.
            </li>
            <li>
              <strong>Không nhớ rõ chỉ số?</strong> Nếu chưa đi khám và không rõ số đo Huyết áp hay Cholesterol, bạn có thể tạm để "Không có" hoặc hỏi Bác sĩ AI.
            </li>
            <li>
              <strong>Lưu ý y khoa:</strong> Kết quả từ hệ thống chỉ mang tính chất tham khảo dự phòng, không có giá trị thay thế chẩn đoán lâm sàn từ bác sĩ chuyên khoa.
            </li>
          </ul>
        </div>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div>
            <label className="label-field" htmlFor="HighBP">
              Huyết áp cao?
            </label>
            <select
              id="HighBP"
              name="HighBP"
              value={form.HighBP}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không có</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="HighChol">
              Cholesterol cao?
            </label>
            <select
              id="HighChol"
              name="HighChol"
              value={form.HighChol}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không có</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <BmiLabelWithTooltip />
            <input
              id="BMI"
              type="number"
              name="BMI"
              value={form.BMI}
              onChange={handleChange}
              onBlur={() => setBmiTouched(true)}
              step="0.1"
              className={`input-field ${showBmiError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/30' : ''}`}
              aria-invalid={showBmiError}
              aria-describedby={showBmiError ? 'bmi-error' : undefined}
            />
            {showBmiError && (
              <p id="bmi-error" className="mt-2 text-sm font-medium text-red-600">
                Chỉ số BMI có vẻ không hợp lệ, vui lòng kiểm tra lại!
              </p>
            )}
          </div>

          <div>
            <label className="label-field" htmlFor="Smoker">
              Hút thuốc?
            </label>
            <select
              id="Smoker"
              name="Smoker"
              value={form.Smoker}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="Diabetes">
              Tiểu đường?
            </label>
            <select
              id="Diabetes"
              name="Diabetes"
              value={form.Diabetes}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Tiền đái tháo đường</option>
              <option value={2}>Có đái tháo đường</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="PhysActivity">
              Vận động (30 ngày qua)?
            </label>
            <select
              id="PhysActivity"
              name="PhysActivity"
              value={form.PhysActivity}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="Fruits">
              Ăn trái cây hàng ngày?
            </label>
            <select
              id="Fruits"
              name="Fruits"
              value={form.Fruits}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="Veggies">
              Ăn rau hàng ngày?
            </label>
            <select
              id="Veggies"
              name="Veggies"
              value={form.Veggies}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="HvyAlcoholConsump">
              Uống rượu nhiều?
            </label>
            <select
              id="HvyAlcoholConsump"
              name="HvyAlcoholConsump"
              value={form.HvyAlcoholConsump}
              onChange={handleChange}
              className="input-field"
            >
              <option value={0}>Không</option>
              <option value={1}>Có</option>
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="Age">
              Nhóm tuổi
            </label>
            <select id="Age" name="Age" value={form.Age} onChange={handleChange} className="input-field">
              {Object.entries(AGE_GROUP_LABELS).map(([value, label]) => (
                <option key={value} value={Number(value)}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="label-field" htmlFor="Sex">
              Giới tính
            </label>
            <select id="Sex" name="Sex" value={form.Sex} onChange={handleChange} className="input-field">
              <option value={0}>Nữ</option>
              <option value={1}>Nam</option>
            </select>
          </div>

          <div className="sm:col-span-2 lg:col-span-3 mt-2">
            <button
              type="submit"
              disabled={loading || bmiInvalid}
              className="w-full btn-brand disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Đang phân tích...' : 'Phân tích nguy cơ'}
            </button>
          </div>
        </form>
      </div>

      {result && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto relative">
            <button
              type="button"
              onClick={() => setResult(null)}
              className="absolute top-4 right-4 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors z-10"
              aria-label="Đóng kết quả"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>

            <div className="p-6 sm:p-8">
              <ResultDashboard result={result} healthDataRaw={submittedForm || form} />
            </div>
          </div>
        </div>
      )}

      {lastRecords.length > 0 && (
        <div className="section-card">
          <h3 className="text-xl font-bold mb-4">Các lần đo gần đây</h3>
          <div className="overflow-x-auto -mx-2">
            <table className="table-modern w-full min-w-[480px]">
              <thead>
                <tr>
                  <th>Ngày đo</th>
                  <th>BMI</th>
                  <th>Huyết áp</th>
                  <th>Nguy cơ</th>
                </tr>
              </thead>
              <tbody>
                {lastRecords.map((record) => (
                  <tr key={record.record_id}>
                    <td>{new Date(record.created_at).toLocaleDateString('vi-VN')}</td>
                    <td>{record.BMI ? record.BMI.toFixed(1) : '—'}</td>
                    <td>{record.HighBP === 1 ? 'Có' : 'Không'}</td>
                    <td className="font-bold">
                      {record.risk_percentage ? `${record.risk_percentage.toFixed(2)}%` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
