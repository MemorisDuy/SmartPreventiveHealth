import React from 'react'
import { Link } from 'react-router-dom'

/** Liên kết quay về trang giới thiệu hệ sinh thái (dashboard) */
export default function FeaturePageBanner({ feature }) {
  if (!feature) return null

  return (
    <div className="rounded-xl border border-brand-200 bg-brand-50/60 px-4 py-3 sm:px-5 sm:py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-semibold text-brand-700 uppercase tracking-wide">
          Tính năng {String(feature.num).padStart(2, '0')} · {feature.tag}
        </p>
        <p className="text-sm text-slate-600 mt-0.5 line-clamp-2 sm:line-clamp-none">
          {feature.description}
        </p>
      </div>
      <Link
        to="/dashboard"
        className="text-sm font-semibold text-brand-700 hover:text-brand-900 whitespace-nowrap shrink-0"
      >
        ← Về hệ sinh thái
      </Link>
    </div>
  )
}
