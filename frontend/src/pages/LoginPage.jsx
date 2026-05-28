import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import api from '../api/axios'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'

export default function LoginPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      if (!email || !password) {
        setError('Vui lòng nhập email và mật khẩu.')
        setLoading(false)
        return
      }

      const response = await api.post('/api/login', { email, password })

      if (response.data.success) {
        localStorage.setItem(
          'user',
          JSON.stringify({
            user_id: response.data.user_id,
            full_name: response.data.full_name,
            email,
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
        setError(
          err.response?.data?.detail ||
            (typeof err.response?.data === 'string' ? err.response.data : 'Lỗi đăng nhập. Vui lòng thử lại.')
        )
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
              <h2 className="text-3xl lg:text-4xl font-bold text-slate-900 mb-3">Chào mừng trở lại</h2>
              <p className="text-slate-600 text-lg leading-relaxed">
                Tiếp tục hành trình chăm sóc sức khỏe thông minh với AI.
              </p>
            </div>
            <div className="space-y-6 pt-8 border-t border-slate-200">
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-3xl font-bold text-brand-600">8+</p>
                  <p className="text-slate-600 text-sm mt-1">Tính năng y tế</p>
                </div>
                <div>
                  <p className="text-3xl font-bold text-brand-600">24/7</p>
                  <p className="text-slate-600 text-sm mt-1">Hỗ trợ AI</p>
                </div>
              </div>
              <blockquote className="text-slate-600 text-sm italic leading-relaxed border-l-2 border-brand-400 pl-4">
                &ldquo;Giao diện rõ ràng, dễ dùng cả trên điện thoại lẫn máy tính.&rdquo;
              </blockquote>
            </div>
          </div>

          <div className="p-6 sm:p-10 lg:p-12">
            <div className="mb-8">
              <h1 className="text-2xl sm:text-3xl font-bold mb-2">Đăng nhập</h1>
              <p className="text-slate-600">Truy cập tài khoản SmartHealthcare của bạn</p>
            </div>

            {error && (
              <div className="alert-error mb-6">
                <p className="font-semibold text-sm">Không thể đăng nhập</p>
                <p className="text-sm mt-1">{error}</p>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <label htmlFor="email" className="label-field">Email</label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@example.com"
                  className="input-field"
                  required
                  disabled={loading}
                />
              </div>

              <div>
                <label htmlFor="password" className="label-field">Mật khẩu</label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Nhập mật khẩu"
                    className="input-field pr-24"
                    required
                    disabled={loading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-medium text-brand-600 hover:text-brand-800"
                  >
                    {showPassword ? 'Ẩn' : 'Hiện'}
                  </button>
                </div>
              </div>

              <button type="submit" disabled={loading} className="w-full btn-brand">
                {loading ? 'Đang xử lý...' : 'Đăng nhập'}
              </button>
            </form>

            <p className="text-center mt-6 text-slate-600">
              Chưa có tài khoản?{' '}
              <Link to="/register" className="font-bold text-brand-600 hover:text-brand-800">
                Đăng ký ngay
              </Link>
            </p>
            <p className="text-center text-xs text-slate-400 mt-4">
              Dữ liệu được bảo mật và mã hóa an toàn.
            </p>
          </div>
        </div>
      </div>

      <Footer variant="light" />
    </div>
  )
}
