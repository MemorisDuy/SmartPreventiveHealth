import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Menu, X } from 'lucide-react'

/*
  GHI CHÚ VẤN ĐÁP:
  Navbar là thanh điều hướng chính sau khi người dùng đăng nhập.
  Vai trò:
  - Liệt kê các route chính: Dashboard, Tầm soát, Tư vấn AI, Dinh dưỡng,
    Giám sát, Lịch sử, FAST Test và SOS.
  - Cho phép đăng xuất bằng cách xóa user khỏi localStorage.
  Khi thầy hỏi web có những module nào:
  - Có thể nhìn vào danh sách navItems trong file này để nêu đủ các tính năng đang mở.
*/

export default function Navbar() {
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : {}

  const handleLogout = () => {
    localStorage.removeItem('user')
    localStorage.removeItem('access_token')
    setMenuOpen(false)
    navigate('/login')
  }

  if (!user.user_id) return null

  const isActive = (path) => location.pathname === path

  const navItems = [
    { path: '/dashboard', label: 'Hệ sinh thái' },
    { path: '/risk-assessment', label: 'Tầm soát' },
    { path: '/chat', label: 'Tư vấn AI' },
    { path: '/diet-analyzer', label: 'Dinh dưỡng' },
    { path: '/smart-surveillance', label: 'Giám sát', badge: 'AI' },
    { path: '/history', label: 'Lịch sử' },
    { path: '/fast-test', label: 'F.A.S.T Test', badge: 'PRO' },
    { path: '/sos-map', label: 'SOS' },
  ]

  const linkClass = (active) =>
    active
      ? 'text-brand-700 bg-brand-50'
      : 'text-slate-600 hover:text-brand-700 hover:bg-slate-50'

  return (
    <header className="sticky top-0 z-[1010] bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-[72px] gap-3">
          
          {/* Logo - LEFT */}
          <Link to="/dashboard" className="flex items-center gap-2 group shrink-0">
            <div className="leading-tight">
              <span className="block font-bold text-sm text-slate-900 group-hover:text-brand-700 transition-colors">
                Smart
              </span>
              <span className="block text-xs text-slate-500 font-medium">Y tế</span>
            </div>
            <span className="flex items-center justify-center w-9 h-9 rounded-lg bg-brand-600 text-white font-bold text-sm shadow-sm">
              S
            </span>
          </Link>

          {/* Menu - CENTER (9 items spread) */}
          <nav className="hidden xl:flex items-center flex-1 gap-0.5 px-2">
            {navItems.map((item) => (
              <Link
                key={item.path + item.label}
                to={item.path}
                className={`px-1 py-2 xl:px-2 rounded-lg text-[11px] xl:text-xs font-semibold whitespace-nowrap transition-colors flex-1 text-center leading-tight flex items-center justify-center gap-1 relative ${
                  linkClass(isActive(item.path))
                }`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`px-1 py-0.5 text-[8px] font-black text-white rounded-md leading-none shadow-sm shrink-0 ${
                    item.badge === 'AI' ? 'bg-cyan-500' : 'bg-purple-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
          </nav>

          {/* Right side - LOGIN/USER + LOGOUT + MENU BUTTON */}
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-medium text-slate-600 hidden lg:block max-w-[100px] truncate">
              {user.full_name || 'Người dùng'}
            </span>
            <button
              type="button"
              onClick={handleLogout}
              className="hidden lg:inline-flex btn-brand-outline text-xs py-2 px-3 min-h-0"
            >
              Đăng xuất
            </button>
            <button
              type="button"
              onClick={() => setMenuOpen(!menuOpen)}
              className="xl:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
              aria-label="Menu"
            >
              {menuOpen ? <X size={24} /> : <Menu size={24} />}
            </button>
          </div>
        </div>

        {/* Mobile menu */}
        {menuOpen && (
          <nav className="xl:hidden pb-4 flex flex-col gap-1 animate-slide-down border-t border-slate-100 pt-3">
            <p className="text-slate-600 text-sm px-4 py-2 lg:hidden">
              Xin chào, <strong className="text-slate-900">{user.full_name}</strong>
            </p>
            {navItems.map((item) => (
              <Link
                key={item.path + item.label}
                to={item.path}
                onClick={() => setMenuOpen(false)}
                className={`${item.sub ? 'px-8 py-2 text-sm' : 'px-4 py-3'} rounded-xl font-semibold transition-colors flex items-center justify-between ${linkClass(
                  isActive(item.path)
                )}`}
              >
                <span>{item.label}</span>
                {item.badge && (
                  <span className={`px-2 py-0.5 text-[9px] font-black text-white rounded-full leading-none ${
                    item.badge === 'AI' ? 'bg-cyan-500' : 'bg-purple-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            ))}
            <button
              type="button"
              onClick={handleLogout}
              className="mt-2 mx-1 btn-brand w-full text-center"
            >
              Đăng xuất
            </button>
          </nav>
        )}
      </div>
    </header>
  )
}
