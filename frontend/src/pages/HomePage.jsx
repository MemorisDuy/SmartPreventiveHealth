import React from 'react'
import { Link } from 'react-router-dom'
import PublicHeader from '../components/PublicHeader'
import Footer from '../components/Footer'
import FeatureDetailCard from '../components/FeatureDetailCard'
import { APP_FEATURES } from '../data/features'

const STEPS = [
  { step: '1', title: 'Đăng ký tài khoản', desc: 'Tạo tài khoản miễn phí — không cần nhập chỉ số ngay.' },
  { step: '2', title: 'Khám phá hệ sinh thái', desc: 'Sau đăng nhập, xem giới thiệu đầy đủ 8 tính năng trên Dashboard.' },
  { step: '3', title: 'Chọn & sử dụng', desc: 'Mở từng tính năng riêng để nhập liệu, chat, SOS...' },
]

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen bg-white">
      <PublicHeader />

      <section className="relative overflow-hidden bg-gradient-to-b from-brand-50 via-white to-white pt-8 pb-16 sm:pt-12 sm:pb-20">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-24 -right-24 w-96 h-96 bg-brand-200/40 rounded-full blur-3xl" />
        </div>
        <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 text-center lg:text-left">
          <div className="lg:max-w-3xl">
            <span className="badge-brand mb-4 inline-block">SmartHealthcare · 8 tính năng AI y tế</span>
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 leading-tight mb-5">
              Hệ sinh thái phòng ngừa{' '}
              <span className="text-brand-600">tim mạch & đột quỵ</span>
            </h1>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              Random Forest, LLM giọng nói, NLP dinh dưỡng, XAI, F.A.S.T Camera và Isolation Forest —
              responsive trên điện thoại và máy tính.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center lg:justify-start">
              <Link to="/register" className="btn-brand text-center">Đăng ký miễn phí</Link>
              <Link to="/login" className="btn-brand-outline text-center">Đăng nhập</Link>
            </div>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-16 bg-slate-50 border-y border-slate-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-center mb-10">Cách sử dụng hệ thống</h2>
          <div className="grid sm:grid-cols-3 gap-5">
            {STEPS.map((item) => (
              <div key={item.step} className="section-card text-center">
                <span className="inline-flex w-10 h-10 items-center justify-center rounded-full bg-brand-600 text-white font-bold mb-3">
                  {item.step}
                </span>
                <h3 className="text-lg font-bold mb-2">{item.title}</h3>
                <p className="text-slate-600 text-sm sm:text-base">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 sm:py-18">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-10">
            <h2 className="mb-3">8 tính năng trong một nền tảng</h2>
            <p className="text-slate-600 text-lg max-w-2xl mx-auto">
              Xem tóm tắt bên dưới. Sau khi đăng nhập, Dashboard hiển thị mô tả chi tiết đầy đủ từng tính năng.
            </p>
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {APP_FEATURES.map((f) => (
              <div key={f.id} className="section-card-hover">
                <span className="feature-number mb-3">{String(f.num).padStart(2, '0')}</span>
                <h3 className="font-bold text-slate-900 mb-2">{f.shortTitle}</h3>
                <p className="text-sm text-slate-600 leading-relaxed line-clamp-4">{f.description}</p>
                <span className="inline-block mt-3 text-xs font-semibold text-brand-600">{f.tag}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="py-14 bg-brand-700 text-center px-4">
        <h2 className="text-white text-2xl sm:text-3xl font-bold mb-4">Sẵn sàng trải nghiệm?</h2>
        <p className="text-brand-100 mb-6 max-w-xl mx-auto">
          Đăng nhập để vào trang Hệ sinh thái — giới thiệu toàn bộ tính năng trước khi nhập liệu.
        </p>
        <Link
          to="/register"
          className="inline-flex px-8 py-4 rounded-xl bg-white text-brand-700 font-bold hover:bg-brand-50 transition-colors"
        >
          Tạo tài khoản
        </Link>
      </section>

      <Footer variant="dark" />
    </div>
  )
}
