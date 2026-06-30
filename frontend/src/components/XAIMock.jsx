import React from 'react'
import { FEATURE_LABELS } from '../data/features'

/*
  GHI CHÚ VẤN ĐÁP:
  Component này hiển thị phần giải thích nhanh dựa trên kết quả dự đoán.
  Input X: result từ API /api/predict, đặc biệt là feature_importances và is_anomaly.
  Hàm xử lý f: sắp xếp các đặc trưng theo độ quan trọng giảm dần và đổi tên kỹ thuật sang tiếng Việt.
  Output y: danh sách yếu tố ảnh hưởng nổi bật và cảnh báo nếu dữ liệu là anomaly.
  Ý nghĩa:
  - Giúp người dùng hiểu lý do phía sau kết quả, thay vì chỉ thấy một con số nguy cơ.
*/

export function XAI_Mock({ result }) {
  if (!result) return null

  const importances = result.feature_importances || {}
  const sorted = Object.entries(importances)
    .map(([key, value]) => ({
      key,
      label: FEATURE_LABELS[key] || key,
      value: Number(value) || 0,
    }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8)

  const maxVal = sorted.length ? Math.max(...sorted.map((s) => s.value), 0.01) : 1
  const isAnomaly = Boolean(result.is_anomaly)

  return (
    <div className="mt-6 grid md:grid-cols-2 gap-4">
      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h4 className="font-bold text-slate-900 mb-1">
          Explainable AI (XAI)
        </h4>
        <p className="text-sm text-slate-600 mb-4">
          Mức đóng góp từng yếu tố lâm sàng (Feature Importance — Random Forest):
        </p>
        {sorted.length > 0 ? (
          <div className="space-y-3">
            {sorted.map((item) => (
              <div key={item.key} className="flex items-center gap-3 text-sm">
                <span className="w-28 sm:w-32 font-medium text-slate-600 shrink-0 truncate" title={item.label}>
                  {item.label}
                </span>
                <div className="flex-1 h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-brand-600 rounded-full transition-all"
                    style={{ width: `${(item.value / maxVal) * 100}%` }}
                  />
                </div>
                <span className="text-xs font-semibold text-slate-500 w-10 text-right">
                  {(item.value * 100).toFixed(0)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Chưa có dữ liệu giải thích từ mô hình.</p>
        )}
        <p className="text-xs text-slate-400 mt-4">
          Ví dụ: hút thuốc, huyết áp cao thường làm tăng rủi ro; vận động, ăn rau có thể giảm rủi ro.
        </p>
      </div>

      <div className="bg-white rounded-xl p-5 border border-slate-200">
        <h4 className="font-bold text-slate-900 mb-1">
          Cảnh báo dị thường (Isolation Forest)
        </h4>
        <p className="text-sm text-slate-600 mb-4">
          Học không giám sát — đối chiếu chỉ số mới với mẫu huấn luyện:
        </p>
        <div
          className={`p-4 rounded-xl border text-sm leading-relaxed ${
            isAnomaly
              ? 'bg-red-50 border-red-300 text-red-900'
              : 'bg-brand-50 border-brand-200 text-brand-900'
          }`}
        >
          {isAnomaly ? (
            <>
              <strong className="text-red-700">CẢNH BÁO ĐỎ — Phát hiện điểm dị thường!</strong>
              <p className="mt-2">
                Chỉ số lần này lệch bất thường so với mô hình chuẩn. Nên theo dõi sát hoặc liên hệ
                bác sĩ, đặc biệt nếu kèm triệu chứng đột ngột.
              </p>
            </>
          ) : (
            <>
              <strong>Tình trạng trong ngưỡng ổn định.</strong>
              <p className="mt-2">
                Isolation Forest không phát hiện điểm bất thường đột biến ở lần đo này.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
