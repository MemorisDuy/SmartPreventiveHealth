import React from 'react'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error, errorInfo) {
    console.error('ErrorBoundary:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="section-card text-center py-12 max-w-lg mx-auto my-8">
          <h2 className="text-2xl font-bold text-slate-900 mb-3">Đã xảy ra lỗi</h2>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Ứng dụng gặp sự cố. Vui lòng tải lại trang hoặc quay về trang chủ.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="btn-brand"
          >
            Tải lại trang
          </button>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
