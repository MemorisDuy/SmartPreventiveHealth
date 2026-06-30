import React from 'react'
import PageHeader from '../components/PageHeader'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này giải thích khái niệm XAI trong hệ thống.
  Input X: các đặc trưng sức khỏe và độ quan trọng của từng đặc trưng.
  Hàm xử lý f: dùng feature_importances_ từ Random Forest để minh bạch hóa kết quả.
  Output y: phần giải thích trực quan cho biết yếu tố nào làm tăng hoặc giảm nguy cơ.
  Khi thầy hỏi vì sao cần XAI:
  - Vì y tế cần tính giải thích được; người dùng không nên chỉ nhận một con số phần trăm,
    mà phải hiểu yếu tố nào đang ảnh hưởng đến nguy cơ.
*/

export default function XAIPage() {
  return (
    <div className="space-y-10 animate-fade-in pb-8">
      <PageHeader
        title="🔍 Giải thích Trí tuệ Nhân tạo (XAI)"
        description="SmartHealthcare không phải 'hộp đen' — hiểu rõ lý do mỗi dự đoán để có kế hoạch chăm sóc sức khỏe tốt nhất."
      />

      <div className="max-w-4xl mx-auto space-y-8">
        {/* Giới thiệu XAI */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md">
          <h3 className="text-2xl font-bold text-slate-900 mb-4">💡 XAI là gì?</h3>
          <p className="text-slate-700 leading-relaxed mb-4">
            <strong>Explainable AI (XAI)</strong> là khả năng giải thích chi tiết từng quyết định của hệ thống AI. Thay vì chỉ nói "nguy cơ 60%", XAI sẽ giải thích: <strong>tại sao lại 60%?</strong> Yếu tố nào làm tăng/giảm?
          </p>
        </div>

        {/* Lợi ích */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">✅ Lợi ích</h3>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h4 className="font-bold text-brand-700 flex items-center gap-2">
                <span className="text-2xl">🎯</span> Hiểu rõ rủi ro
              </h4>
              <p className="text-slate-700 text-sm">
                Biết chính xác yếu tố nào làm tăng nguy cơ bệnh tim mạch/đột quỵ của bạn.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-brand-700 flex items-center gap-2">
                <span className="text-2xl">📋</span> Hành động cụ thể
              </h4>
              <p className="text-slate-700 text-sm">
                Biết nên thay đổi gì trước (huyết áp, BMI, hút thuốc...) để giảm rủi ro.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-brand-700 flex items-center gap-2">
                <span className="text-2xl">👨‍⚕️</span> Tư vấn tốt hơn
              </h4>
              <p className="text-slate-700 text-sm">
                Bác sĩ có thể tư vấn chính xác hơn dựa trên yếu tố nào nguy hiểm nhất.
              </p>
            </div>

            <div className="space-y-2">
              <h4 className="font-bold text-brand-700 flex items-center gap-2">
                <span className="text-2xl">🔄</span> Theo dõi tiến bộ
              </h4>
              <p className="text-slate-700 text-sm">
                Khi thay đổi thói quen, XAI sẽ hiển thị rủi ro giảm đi bao nhiêu %.
              </p>
            </div>
          </div>
        </div>

        {/* Cách hoạt động */}
        <div className="bg-white border border-slate-200 rounded-2xl p-8 shadow-md">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">🔧 Cách hoạt động</h3>
          <div className="space-y-4">
            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Điền thông tin sức khỏe</h4>
                <p className="text-slate-700 text-sm">Huyết áp, BMI, hút thuốc, vận động...</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Hệ thống dự đoán</h4>
                <p className="text-slate-700 text-sm">AI phân tích dữ liệu và tính mức rủi ro</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Biểu đồ XAI hiển thị</h4>
                <p className="text-slate-700 text-sm">Xem yếu tố nào TĂNG (🟥) và GIẢM (🟩) rủi ro</p>
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center font-bold text-sm">
                4
              </div>
              <div>
                <h4 className="font-bold text-slate-900">Bác sĩ AI gợi ý</h4>
                <p className="text-slate-700 text-sm">Nhận lời khuyên cụ thể để cải thiện sức khỏe</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ví dụ */}
        <div className="bg-gradient-to-br from-brand-50 to-teal-50 border border-brand-200 rounded-2xl p-8">
          <h3 className="text-2xl font-bold text-slate-900 mb-6">📊 Ví dụ</h3>
          <div className="space-y-4">
            <div className="bg-white rounded-lg p-4 border-l-4 border-red-500">
              <p className="font-bold text-slate-900 mb-2">Bệnh nhân A (Nguy cơ cao)</p>
              <p className="text-slate-700 text-sm">
                <strong>Nguy cơ: 65%</strong> vì huyết áp cao (+25%), hút thuốc (+15%), BMI thừa cân (+10%), ít vận động (+15%)
              </p>
              <p className="text-slate-700 text-sm mt-2">
                <strong>💡 Lời khuyên:</strong> Giảm huyết áp và bỏ thuốc là ưu tiên hàng đầu!
              </p>
            </div>

            <div className="bg-white rounded-lg p-4 border-l-4 border-green-500">
              <p className="font-bold text-slate-900 mb-2">Bệnh nhân B (Nguy cơ thấp)</p>
              <p className="text-slate-700 text-sm">
                <strong>Nguy cơ: 25%</strong> vì huyết áp bình thường, tập thể dục đều đặn (-12%), ăn rau xanh (-8%)
              </p>
              <p className="text-slate-700 text-sm mt-2">
                <strong>💡 Lời khuyên:</strong> Tiếp tục duy trì thói quen tốt!
              </p>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="bg-brand-50 border border-brand-200 rounded-2xl p-8 text-center">
          <h3 className="text-xl font-bold text-slate-900 mb-3">🚀 Sẵn sàng kiểm tra rủi ro?</h3>
          <p className="text-slate-700 mb-6">
            Bấm vào "Tầm soát" để dự đoán nguy cơ và xem biểu đồ XAI chi tiết của bạn.
          </p>
          <a
            href="/risk-assessment"
            className="inline-block px-8 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold rounded-lg transition-colors"
          >
            Bắt đầu Tầm soát →
          </a>
        </div>
      </div>
    </div>
  )
}
