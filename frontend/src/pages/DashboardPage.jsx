import React, { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import FeatureDetailCard from '../components/FeatureDetailCard'
import { CORE_FEATURES, ADVANCED_FEATURES } from '../data/features'
import { LayoutGrid, List, Sparkles } from 'lucide-react'

/*
  GHI CHÚ VẤN ĐÁP:
  Dashboard là trang tổng quan hệ sinh thái chức năng.
  Input X: thông tin user trong localStorage và danh sách tính năng từ data/features.js.
  Hàm xử lý f: React render danh sách module, chia nhóm tính năng cốt lõi và AI nâng cao.
  Output y: giao diện để người dùng truy cập nhanh Tầm soát, Tư vấn AI, Dinh dưỡng,
  Lịch sử, SOS, XAI, FAST và Giám sát AI.
  Đây là phần tổ chức trải nghiệm người dùng, không phải thuật toán AI.
*/

export default function DashboardPage() {
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : { full_name: 'Khách' }

  // Tự động chọn chế độ xem: Mobile mặc định thu gọn, PC mặc định chi tiết
  const [viewMode, setViewMode] = useState('detailed')

  useEffect(() => {
    const handleInitialViewMode = () => {
      if (window.innerWidth < 768) {
        setViewMode('compact')
      } else {
        setViewMode('detailed')
      }
    }
    handleInitialViewMode()
  }, [])

  return (
    <div className="space-y-8 sm:space-y-10 animate-fade-in pb-8">
      {/* Welcome Hero Banner */}
      <div className="relative">
        <PageHeader
          title={`Xin chào, ${user.full_name}!`}
          description="Hệ sinh thái y tế thông minh tích hợp dành cho mọi lứa tuổi. Dưới đây là các tính năng giúp bạn chủ động tầm soát rủi ro tim mạch, phân tích chế độ dinh dưỡng, theo dõi chỉ số sức khỏe trực quan và kết nối cứu hộ khẩn cấp."
        />
      </div>

      {/* Quick Guide & View Mode Control */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-white/60 backdrop-blur-sm p-4 rounded-2xl border border-slate-200/60 shadow-sm">
        <div className="flex items-start gap-2.5 text-slate-700 text-xs sm:text-sm">
          <Sparkles className="w-5 h-5 text-brand-600 shrink-0 mt-0.5" />
          <div>
            <strong>Hướng dẫn nhanh:</strong> Nhấp chọn nút hành động bên dưới mỗi thẻ tính năng để bắt đầu sử dụng. Bạn có thể sử dụng bộ gạt bên phải để thu gọn danh sách.
          </div>
        </div>

        {/* View Mode Toggle Switch */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/80 shadow-inner shrink-0 self-end md:self-auto">
          <button
            type="button"
            onClick={() => setViewMode('detailed')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              viewMode === 'detailed'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Hiển thị chi tiết công nghệ"
          >
            <List size={14} />
            <span>Chi tiết</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('compact')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-extrabold transition-all ${
              viewMode === 'compact'
                ? 'bg-white text-brand-700 shadow-sm'
                : 'text-slate-500 hover:text-slate-800'
            }`}
            title="Hiển thị lưới thu gọn"
          >
            <LayoutGrid size={14} />
            <span>Thu gọn</span>
          </button>
        </div>
      </div>

      {/* Section I: Core Features */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-1.5 bg-emerald-500 rounded-full" />
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-wide">
              I. NHÓM TÍNH NĂNG CỐT LÕI
            </h2>
          </div>
          <span className="text-[11px] font-extrabold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-100 rounded-full shadow-sm">
            Machine Learning · LLM · SOS
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {CORE_FEATURES.map((f) => (
            <FeatureDetailCard key={f.id} feature={f} compact={viewMode === 'compact'} />
          ))}
        </div>
      </section>

      {/* Section II: Advanced AI Features */}
      <section className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="h-6 w-1.5 bg-purple-500 rounded-full" />
            <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-wide">
              II. NHÓM TÍNH NĂNG AI NÂNG CAO
            </h2>
          </div>
          <span className="text-[11px] font-extrabold px-3 py-1 bg-purple-50 text-purple-700 border border-purple-100 rounded-full shadow-sm">
            Explainable AI · Computer Vision
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {ADVANCED_FEATURES.map((f) => (
            <FeatureDetailCard key={f.id} feature={f} compact={viewMode === 'compact'} />
          ))}
        </div>
      </section>

      {/* Recommendation Banner */}
      <section className="rounded-3xl bg-gradient-to-br from-brand-700 via-brand-600 to-emerald-600 text-white border border-brand-500/20 p-6 sm:p-8 lg:p-10 shadow-[0_15px_40px_rgba(16,185,129,0.15)] relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 space-y-4 max-w-3xl">
          <h3 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-brand-200" />
            Khuyến nghị bắt đầu trải nghiệm
          </h3>
          <p className="text-brand-50 text-sm sm:text-base leading-relaxed max-w-2xl font-medium">
            Nếu đây là lần đầu tiên bạn sử dụng ứng dụng: hãy thực hiện <strong className="text-white underline decoration-brand-200 decoration-2">Tầm soát rủi ro</strong> trước tiên để nhận kết quả phân tích học máy (%, biểu đồ XAI đóng góp chỉ số, và cảnh báo điểm dị thường Isolation Forest). Tiếp đó, bạn có thể xem lại trong <strong className="text-white underline decoration-brand-200 decoration-2">Lịch sử</strong> hoặc trò chuyện trực tiếp với <strong className="text-white underline decoration-brand-200 decoration-2">Bác sĩ AI</strong> để nhận các tư vấn sức khỏe cá nhân hóa.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 pt-3">
            <Link
              to="/risk-assessment"
              className="inline-flex justify-center items-center min-h-[48px] px-6 py-3 rounded-xl bg-white text-brand-700 font-bold hover:bg-brand-50 hover:scale-[1.02] transition-all shadow-md text-sm sm:text-base"
            >
              Tầm soát rủi ro ngay
            </Link>
            <Link
              to="/chat"
              className="inline-flex justify-center items-center min-h-[48px] px-6 py-3 rounded-xl border border-white/60 bg-white/10 text-white font-bold hover:bg-white/20 hover:scale-[1.02] transition-all text-sm sm:text-base"
            >
              Hỏi bác sĩ AI
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
