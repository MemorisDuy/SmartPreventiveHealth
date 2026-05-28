import React from 'react'

export default function PageHeader({ title, description, children }) {
  return (
    <div className="page-hero animate-fade-in">
      <div className="absolute -top-16 -right-16 w-56 h-56 bg-brand-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="relative z-10">
        <h1 className="page-hero-title">{title}</h1>
        {description && <p className="page-hero-desc text-gray-700">{description}</p>}
        {children}
      </div>
    </div>
  )
}
