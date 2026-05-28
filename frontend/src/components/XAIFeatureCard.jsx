import React from 'react'
import { useNavigate } from 'react-router-dom'

export default function XAIFeatureCard() {
  const navigate = useNavigate()

  const handleCtaClick = () => {
    navigate('/risk-assessment')
  }

  const handleLearnMoreClick = () => {
    navigate('/xai')
  }

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Thẻ chính với Glassmorphism */}
      <div className="bg-white/40 backdrop-blur-md border border-white/50 rounded-3xl shadow-xl p-8 overflow-hidden hover:shadow-2xl transition-shadow duration-300">
        
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-6">
            {/* Số thứ tự */}
            <div className="flex-shrink-0">
              <div className="bg-green-100 text-green-800 rounded-xl px-4 py-2 font-bold text-lg min-w-[60px] text-center">
                06
              </div>
            </div>
            
            {/* Badge & Tiêu đề */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-3">
                <span className="inline-block bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold">
                  Explainable AI
                </span>
              </div>
              <h3 className="text-2xl font-bold text-slate-900 leading-tight">
                Trí tuệ Nhân tạo Có thể giải thích (XAI)
              </h3>
            </div>
          </div>

          {/* Đoạn mô tả chính */}
          <p className="text-slate-700 leading-relaxed text-base">
            Thay vì con số 'hộp đen', hệ thống giải thích lý do mức rủi ro - yếu tố nào làm tăng/giảm nguy cơ.
          </p>
        </div>

        {/* Khối Công nghệ cốt lõi */}
        <div className="mb-6 bg-white rounded-xl p-5 border border-slate-100">
          <h4 className="text-sm font-bold text-slate-900 mb-3 uppercase tracking-wide">
            🔧 Công nghệ cốt lõi
          </h4>
          <p className="text-sm text-slate-700 leading-relaxed">
            Feature Importance từ Random Forest (minh bạch hóa tương tự SHAP) - đóng góp từng chỉ số lâm sàng.
          </p>
        </div>

        {/* Khối Đầu ra */}
        <div className="mb-6 bg-green-50/80 rounded-xl p-5 border border-green-100">
          <h4 className="text-sm font-bold text-green-800 mb-3 uppercase tracking-wide">
            📊 Đầu ra
          </h4>
          <p className="text-sm text-green-700 leading-relaxed">
            Biểu đồ đóng góp yếu tố; biết chính xác cần thay đổi thói quen nào.
          </p>
        </div>

        {/* Khối Lưu ý */}
        <div className="mb-8 bg-yellow-50 text-yellow-800 px-5 py-3 rounded-lg border border-yellow-100">
          <p className="text-sm font-medium">
            ⚠️ Hiển thị sau khi hoàn tất tầm soát rủi ro.
          </p>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleCtaClick}
            className="flex-1 bg-[#1a6b4c] text-white font-bold py-3 px-6 rounded-xl transition-all duration-300 hover:bg-green-800 active:scale-95 shadow-md hover:shadow-lg"
          >
            Tầm soát ngay
          </button>
          
          <button
            onClick={handleLearnMoreClick}
            className="flex-1 sm:flex-auto border-2 border-slate-300 text-slate-700 font-semibold py-3 px-6 rounded-xl transition-all duration-300 hover:border-brand-600 hover:text-brand-600 hover:bg-brand-50 active:scale-95"
          >
            🔍 Tìm hiểu cơ chế
          </button>
        </div>
      </div>
    </div>
  )
}
