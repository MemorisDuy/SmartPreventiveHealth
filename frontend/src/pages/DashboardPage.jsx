import React from 'react'
import { Link } from 'react-router-dom'
import PageHeader from '../components/PageHeader'
import FeatureDetailCard from '../components/FeatureDetailCard'
import { CORE_FEATURES, ADVANCED_FEATURES } from '../data/features'

export default function DashboardPage() {
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : { full_name: 'Khách' }

  return (
    <div className="space-y-10 sm:space-y-12 animate-fade-in pb-8">
      <PageHeader
        title={`Xin chào, ${user.full_name}!`}
        description="SmartHealthcare được thiết kế cho mọi lứa tuổi - hệ sinh thái toàn diện giúp bạn hiểu rõ cách phòng ngừa bệnh đột quỵ, tim mạch và các bệnh mạn tính. Khám phá các tính năng dưới đây để tầm soát sức khỏe, nhận lời khuyên AI, và quản lý sức khỏe toàn diện."
      />

      <div className="alert-info text-sm sm:text-base">
        <strong>Hướng dẫn:</strong> Bạn không cần nhập chỉ số ngay tại đây. Nhấn nút trên từng thẻ để mở
        trang chức năng tương ứng (tầm soát, chat, dinh dưỡng, SOS...).
      </div>

      <section>
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
              I. Nhóm tính năng cốt lõi
            </h2>
            <p className="text-slate-600 mt-1 text-sm sm:text-base">
              Machine Learning, LLM, NLP, theo dõi sức khỏe & khẩn cấp SOS
            </p>
          </div>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {CORE_FEATURES.map((f) => (
            <FeatureDetailCard key={f.id} feature={f} />
          ))}
        </div>
      </section>

      <section>
        <div className="mb-6">
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
            II. Nhóm tính năng AI nâng cao
          </h2>
          <p className="text-slate-600 mt-1 text-sm sm:text-base">
            Điểm nhấn đồ án — XAI, Computer Vision F.A.S.T, Isolation Forest
          </p>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-5">
          {ADVANCED_FEATURES.map((f) => (
            <FeatureDetailCard key={f.id} feature={f} />
          ))}
        </div>
      </section>

      <section className="section-card bg-gradient-to-r from-brand-700 to-brand-600 text-white border-0">
        <h3 className="text-lg sm:text-xl font-bold mb-2">Bắt đầu từ đâu?</h3>
        <p className="text-brand-50 text-sm sm:text-base leading-relaxed mb-5 max-w-2xl">
          Lần đầu sử dụng: thực hiện <strong className="text-white">Tầm soát rủi ro</strong> để có
          kết quả %, XAI và cảnh báo dị thường. Sau đó xem <strong className="text-white">Lịch sử</strong>{' '}
          hoặc trò chuyện <strong className="text-white">Tư vấn AI</strong>.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            to="/risk-assessment"
            className="inline-flex justify-center px-6 py-3 rounded-xl bg-white text-brand-700 font-bold hover:bg-brand-50 transition-colors"
          >
            Tầm soát rủi ro ngay
          </Link>
          <Link
            to="/chat"
            className="inline-flex justify-center px-6 py-3 rounded-xl border-2 border-white/80 text-white font-semibold hover:bg-white/10 transition-colors"
          >
            Hỏi bác sĩ AI
          </Link>
        </div>
      </section>
    </div>
  )
}
