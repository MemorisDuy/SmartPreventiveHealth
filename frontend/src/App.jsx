import React, { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Navbar from './components/Navbar'
import GlobalMascot from './components/GlobalMascot'
import SmartSurveillance from './components/SmartSurveillance'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import RiskAssessmentPage from './pages/RiskAssessmentPage'
import FastTestPage from './pages/FastTestPage'
import ChatPage from './pages/ChatPage'
import SOSMapPage from './pages/SOSMapPage'
import DietAnalyzerPage from './pages/DietAnalyzerPage'
import HistoryPage from './pages/HistoryPage'
import XAIPage from './pages/XAIPage'
import HomePage from './pages/HomePage'
import ErrorBoundary from './components/ErrorBoundary'
import { SurveillanceProvider } from './context/SurveillanceContext'
import 'regenerator-runtime/runtime'

function ProtectedRoute({ children }) {
  const user = localStorage.getItem('user')
  return user ? children : <Navigate to="/login" replace />
}

function AppLayout({ children }) {
  const location = useLocation()
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
  
  const publicPages = ['/', '/login', '/register']
  const isPublic = publicPages.includes(location.pathname)
  const showNavbar = !isPublic

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Chọn ảnh nền dựa trên kích thước màn hình
  const backgroundUrl = isMobile ? '/assets/webdienthoai.png' : '/assets/webmaytinh.png'

  return (
    <div
      className="min-h-screen flex flex-col bg-slate-50"
      style={{
        backgroundImage: `url(${backgroundUrl})`,
        backgroundSize: 'cover',
        backgroundAttachment: isMobile ? 'scroll' : 'fixed',
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'center'
      }}
    >
      {showNavbar && <Navbar />}
      <main className={`flex-1 ${showNavbar ? 'page-shell' : ''}`}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <BrowserRouter
      future={{
        v7_startTransition: true,
        v7_relativeSplatPath: true,
      }}
    >
      <SurveillanceProvider>
        <GlobalMascot />
        <AppLayout>
          <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />

          <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
          <Route path="/risk-assessment" element={<ProtectedRoute><RiskAssessmentPage /></ProtectedRoute>} />
          <Route path="/xai" element={<ProtectedRoute><XAIPage /></ProtectedRoute>} />
          <Route path="/fast-test" element={<ProtectedRoute><FastTestPage /></ProtectedRoute>} />
          <Route path="/chat" element={<ProtectedRoute><ChatPage /></ProtectedRoute>} />
          <Route path="/sos-map" element={<ProtectedRoute><SOSMapPage /></ProtectedRoute>} />
          <Route path="/diet-analyzer" element={<ProtectedRoute><DietAnalyzerPage /></ProtectedRoute>} />
          <Route path="/smart-surveillance" element={<ProtectedRoute><SmartSurveillance /></ProtectedRoute>} />
          <Route path="/history" element={<ProtectedRoute><HistoryPage /></ProtectedRoute>} />

          <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AppLayout>
      </SurveillanceProvider>
    </BrowserRouter>
  )
}
