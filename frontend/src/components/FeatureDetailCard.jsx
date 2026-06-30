import React from 'react'
import { Link } from 'react-router-dom'
import { 
  Activity, 
  MessageSquare, 
  Utensils, 
  LineChart, 
  ShieldAlert, 
  Brain, 
  Camera, 
  BellRing 
} from 'lucide-react'

/*
  GHI CHÚ VẤN ĐÁP:
  Component này hiển thị từng thẻ tính năng trên Dashboard.
  Input X: object feature từ data/features.js.
  Hàm xử lý f: chọn icon, màu sắc, mô tả, công nghệ và đường dẫn tương ứng với từng module.
  Output y: một card chức năng để người dùng đọc nhanh và bấm vào trải nghiệm.
  Ý nghĩa:
  - Đây là phần trình bày sản phẩm, giúp người xem hiểu hệ thống gồm những module nào.
*/

const ICON_MAP = {
  risk: { icon: Activity, colorClass: 'text-rose-600 bg-rose-50 border-rose-100' },
  chat: { icon: MessageSquare, colorClass: 'text-emerald-600 bg-emerald-50 border-emerald-100' },
  diet: { icon: Utensils, colorClass: 'text-amber-600 bg-amber-50 border-amber-100' },
  history: { icon: LineChart, colorClass: 'text-blue-600 bg-blue-50 border-blue-100' },
  sos: { icon: ShieldAlert, colorClass: 'text-red-600 bg-red-50 border-red-100 shadow-sm animate-pulse' },
  xai: { icon: Brain, colorClass: 'text-purple-600 bg-purple-50 border-purple-100' },
  fast: { icon: Camera, colorClass: 'text-indigo-600 bg-indigo-50 border-indigo-100' },
  anomaly: { icon: BellRing, colorClass: 'text-cyan-600 bg-cyan-50 border-cyan-100' },
}

export default function FeatureDetailCard({ feature, compact = false }) {
  const isAdvanced = feature.category === 'advanced'
  const config = ICON_MAP[feature.id] || { icon: Activity, colorClass: 'text-slate-600 bg-slate-50 border-slate-100' }
  const IconComponent = config.icon

  return (
    <article
      className={`rounded-2xl border p-5 sm:p-6 flex flex-col h-full transition-all duration-300 transform hover:-translate-y-1 ${
        isAdvanced
          ? 'bg-gradient-to-br from-slate-50/90 via-brand-50/5 to-white/90 border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_35px_rgba(79,70,229,0.08)] hover:border-brand-300'
          : 'bg-white/90 border-slate-200/80 shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-[0_12px_35px_rgba(16,185,129,0.08)] hover:border-brand-300'
      } backdrop-blur-md`}
    >
      <div className="flex items-start gap-4 mb-4">
        {/* Icon Area */}
        <div className={`flex items-center justify-center w-12 h-12 rounded-2xl border shrink-0 shadow-sm ${config.colorClass}`}>
          <IconComponent size={22} />
        </div>
        
        <div className="flex-1 min-w-0">
          <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-1.5 ${
            isAdvanced 
              ? 'bg-purple-50 text-purple-700 border border-purple-100' 
              : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
          }`}>
            {feature.tag}
          </span>
          <h3 className="text-base sm:text-lg font-extrabold text-slate-800 leading-snug group-hover:text-brand-700 transition-colors">
            {compact ? feature.shortTitle : feature.title}
          </h3>
        </div>
      </div>

      <p className="text-slate-600 font-medium text-xs sm:text-sm leading-relaxed mb-4 flex-1">
        {feature.description}
      </p>

      {!compact && (
        <div className="space-y-3 mb-5 text-xs">
          <div className="rounded-xl bg-slate-50/80 border border-slate-100 p-3 shadow-inner-sm">
            <p className="font-bold text-slate-700 mb-1 uppercase tracking-wider text-[10px]">Công nghệ cốt lõi</p>
            <p className="text-slate-500 font-medium leading-relaxed">{feature.technology}</p>
          </div>
          <div className="rounded-xl bg-brand-50/40 border border-brand-100/50 p-3">
            <p className="font-bold text-brand-800 mb-1 uppercase tracking-wider text-[10px]">Đầu ra dữ liệu</p>
            <p className="text-brand-600 font-semibold leading-relaxed">{feature.output}</p>
          </div>
          {feature.note && (
            <p className="text-[11px] text-amber-700 bg-amber-50/70 border border-amber-100/60 rounded-xl px-3 py-2 leading-relaxed">
              💡 {feature.note}
            </p>
          )}
        </div>
      )}

      <Link
        to={feature.path}
        className="btn-brand w-full text-center text-sm font-bold min-h-[48px] rounded-xl flex items-center justify-center gap-2 mt-auto shadow-sm hover:shadow transition-all"
      >
        <span>{feature.cta}</span>
      </Link>
    </article>
  )
}
