import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này xử lý đăng ký tài khoản mới.
  Input X: họ tên, email, mật khẩu và xác nhận mật khẩu.
  Hàm xử lý f:
  - Frontend kiểm tra dữ liệu cơ bản như mật khẩu khớp hay chưa.
  - Backend /api/register kiểm tra email đã tồn tại chưa và hash mật khẩu bằng bcrypt.
  Output y: tài khoản user mới trong database.
  Khi thầy hỏi bảo mật:
  - Mật khẩu không lưu dạng chữ thường, mà được mã hóa hash trước khi lưu.
*/

const BENEFITS = [
  { title: 'Bảo mật tuyệt đối', desc: 'Dữ liệu sức khỏe được bảo vệ an toàn.' },
  { title: 'Đăng ký nhanh', desc: 'Chỉ mất một phút để bắt đầu sử dụng.' },
  { title: 'Hỗ trợ 24/7', desc: 'Bác sĩ AI luôn sẵn sàng tư vấn.' },
]

export default function RegisterPage() {
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleChange = (e) => {
    const { name, value } = e.target
    setFormData((prev) => ({ ...prev, [name]: value }))
  }

  const validateForm = () => {
    if (!formData.fullName.trim() || !formData.email.trim()) {
      setError('Vui lòng nhập đầy đủ họ tên và email.')
      return false
    }
    if (formData.password.length < 6) {
      setError('Mật khẩu phải có ít nhất 6 ký tự.')
      return false
    }
    if (formData.password !== formData.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.')
      return false
    }
    return true
  }

  const handleRegister = async (e) => {
    e.preventDefault()
    setError('')
    if (!validateForm()) return

    setLoading(true)
    try {
      const response = await api.post('/api/register', {
        full_name: formData.fullName,
        email: formData.email,
        password: formData.password,
      })

      if (response.data.success) {
        localStorage.setItem(
          'user',
          JSON.stringify({
            user_id: response.data.user_id,
            full_name: formData.fullName,
            email: formData.email,
          })
        )
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      if (!err.response) {
        setError(
          'Không kết nối được máy chủ. Hãy mở terminal backend và chạy: uvicorn main:app --reload --port 5000'
        )
      } else {
        setError(err.response?.data?.detail || 'Lỗi đăng ký. Vui lòng thử lại.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col min-h-screen bg-gradient-to-b from-brand-50/40 via-slate-50 to-slate-50">
      <PublicHeader />

      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-14">
        <div className="w-full max-w-5xl grid md:grid-cols-2 gap-0 bg-white rounded-2xl border border-slate-200 shadow-card-hover overflow-hidden animate-fade-in">
          <div className="hidden md:flex flex-col justify-between p-10 lg:p-12 bg-gradient-to-br from-brand-50 via-brand-100/60 to-white border-r border-slate-100">
            <div>
              <span className="badge-brand mb-4 inline-block">SmartHealthcare</span>
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Tham gia ngay</h2>
              <p className="text-slate-600 text-lg leading-relaxed mb-10">
                Cộng đồng chăm sóc sức khỏe thông minh đang chờ bạn.
              </p>
              <ul className="space-y-5">
                {BENEFITS.map((b) => (
                  <li key={b.title} className="flex gap-3">
                    <span className="w-8 h-8 rounded-lg bg-brand-600 text-white flex items-center justify-center text-sm font-bold shrink-0">
                      ✓
                    </span>
                    <div>
                      <p className="font-bold text-slate-900">{b.title}</p>
                      <p className="text-slate-600 text-sm mt-0.5">{b.desc}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Đăng ký</h1>
              <p className="text-slate-600">Bắt đầu hành trình sức khỏe thông minh</p>
            </div>

            {error && (
              <div className="alert-error mb-6">
                <p className="font-semibold text-sm">Không thể đăng ký</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label htmlFor="fullName" className="label-field">Họ và tên</label>
                <input
                  id="fullName"
                  type="text"
                  name="fullName"
                  value={formData.fullName}
                  onChange={handleChange}
                  placeholder="Nguyễn Văn A"
                  className="input-field"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="email" className="label-field">Email</label>
                <input
                  id="email"
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="email@example.com"
                  className="input-field"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="password" className="label-field">Mật khẩu (tối thiểu 6 ký tự)</label>
                <input
                  id="password"
                  type="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Tạo mật khẩu"
                  className="input-field"
                  required
                  disabled={loading}
                />
              </div>
              <div>
                <label htmlFor="confirmPassword" className="label-field">Xác nhận mật khẩu</label>
                <input
                  id="confirmPassword"
                  type="password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Nhập lại mật khẩu"
                  className="input-field"
                  required
                  disabled={loading}
                />
              </div>

              <button type="submit" disabled={loading} className="w-full btn-brand mt-2">
                {loading ? 'Đang xử lý...' : 'Đăng ký tài khoản'}
              </button>
            </form>

            <p className="text-center mt-6 text-slate-600">
              Đã có tài khoản?{' '}
              <Link to="/login" className="font-bold text-brand-600 hover:text-brand-800">
                Đăng nhập
              </Link>
            </p>
            <p className="text-center text-xs text-slate-400 mt-4">
              Bằng việc đăng ký, bạn đồng ý với Điều khoản dịch vụ và Chính sách bảo mật.
            </p>
          </div>
        </div>
      </div>

      <Footer variant="light" />
    </div>
  )
}

