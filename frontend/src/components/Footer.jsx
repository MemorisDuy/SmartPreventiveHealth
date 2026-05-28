import React from 'react'
import { Link } from 'react-router-dom'

export default function Footer({ variant = 'dark' }) {
  const isDark = variant === 'dark'

  return (
    <footer className={isDark ? 'bg-slate-900 text-slate-400' : 'bg-white border-t border-slate-200 text-slate-600'}>
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          <div className="sm:col-span-2">
            <div className="flex items-center gap-2 mb-3">
              <span className="w-9 h-9 rounded-lg bg-brand-600 text-white font-bold flex items-center justify-center">
                S
              </span>
              <span className={`font-bold text-lg ${isDark ? 'text-white' : 'text-slate-900'}`}>
                SmartHealthcare
              </span>
            </div>
            <p className="text-sm leading-relaxed max-w-md">
              Hệ sinh thái AI y tế phòng ngừa — tầm soát rủi ro tim mạch, dinh dưỡng, đột quỵ và hỗ trợ khẩn cấp trên mọi thiết bị.
            </p>
          </div>
          <div>
            <h4 className={`font-semibold mb-3 text-sm uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              Liên kết
            </h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/" className="hover:text-brand-400 transition-colors">Trang chủ</Link></li>
              <li><Link to="/login" className="hover:text-brand-400 transition-colors">Đăng nhập</Link></li>
              <li><Link to="/register" className="hover:text-brand-400 transition-colors">Đăng ký</Link></li>
            </ul>
          </div>
          <div>
            <h4 className={`font-semibold mb-3 text-sm uppercase tracking-wide ${isDark ? 'text-slate-300' : 'text-slate-800'}`}>
              Tính năng
            </h4>
            <ul className="space-y-2 text-sm">
              <li>Tầm soát rủi ro AI</li>
              <li>Tư vấn sức khỏe 24/7</li>
              <li>Bản đồ SOS khẩn cấp</li>
            </ul>
          </div>
        </div>
        <div className={`pt-6 border-t text-sm text-center ${isDark ? 'border-slate-800' : 'border-slate-200'}`}>
          &copy; {new Date().getFullYear()} SmartHealthcare. Phục vụ đồ án học thuật & ứng dụng thực tiễn.
        </div>
      </div>
    </footer>
  )
}
