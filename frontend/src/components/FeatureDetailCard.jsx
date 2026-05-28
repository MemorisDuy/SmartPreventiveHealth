import React from 'react'
import { Link } from 'react-router-dom'

export default function FeatureDetailCard({ feature, compact = false }) {
  const isAdvanced = feature.category === 'advanced'

  return (
    <article
      className={`rounded-2xl border p-5 sm:p-6 flex flex-col h-full transition-all ${
        isAdvanced
          ? 'bg-gradient-to-br from-slate-50 to-brand-50/30 border-slate-200 hover:border-brand-300 hover:shadow-card'
          : 'bg-white/90 border-slate-200 hover:border-brand-300 hover:shadow-card-hover'
      }`}
    >
      <div className="flex flex-wrap items-start gap-3 mb-3">
        <span className="feature-number">{String(feature.num).padStart(2, '0')}</span>
        <div className="flex-1 min-w-0">
          <span className="badge-brand text-xs mb-2 inline-block">{feature.tag}</span>
          <h3 className="text-base sm:text-lg font-bold text-slate-900 leading-snug">
            {compact ? feature.shortTitle : feature.title}
          </h3>
        </div>
      </div>

      <p className="text-gray-800 font-medium text-sm sm:text-base leading-relaxed mb-4 flex-1">
        {feature.description}
      </p>

      {!compact && (
        <div className="space-y-3 mb-4 text-sm">
          <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
            <p className="font-bold text-gray-900 mb-1">Công nghệ cốt lõi</p>
            <p className="text-gray-800 font-medium leading-relaxed">{feature.technology}</p>
          </div>
          <div className="rounded-xl bg-brand-50/80 border border-brand-100 p-3">
            <p className="font-semibold text-green-900 mb-1">Đầu ra</p>
            <p className="text-green-900 font-semibold leading-relaxed">{feature.output}</p>
          </div>
          {feature.note && (
            <p className="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
              {feature.note}
            </p>
          )}
        </div>
      )}

      <Link
        to={feature.path}
        className="btn-brand w-full text-center text-sm sm:text-base mt-auto"
      >
        {feature.cta}
      </Link>
    </article>
  )
}
