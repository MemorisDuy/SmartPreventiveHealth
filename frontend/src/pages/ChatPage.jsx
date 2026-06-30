import React, { useState, useEffect, useRef } from 'react'
import { useLocation, Link } from 'react-router-dom'
import api from '../api/axios'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import { Mic, MicOff, Send, Sparkles, Plus, MessageSquare, Menu, X, ArrowLeft } from 'lucide-react'
import { getFeatureById } from '../data/features'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này là module Tư vấn AI.
  Input X: câu hỏi người dùng, user_id, loại chat và session_id.
  Hàm xử lý f:
  - Frontend nhận text hoặc giọng nói qua react-speech-recognition.
  - Gửi câu hỏi đến backend /api/chat.
  - Backend dùng LLM như Gemini, OpenRouter hoặc Groq để sinh phản hồi.
  Output y: câu trả lời tư vấn sức khỏe và lịch sử hội thoại theo phiên.
  Lưu ý:
  - AI chỉ tư vấn tham khảo/phòng ngừa, không thay thế bác sĩ.
*/

const WELCOME_MESSAGE =
  'Xin chào! Tôi là Bác sĩ AI của SmartHealthcare. Bạn có thể hỏi về huyết áp, cholesterol, chế độ ăn, triệu chứng tim mạch hoặc cách phòng ngừa đột quỵ.'

export default function ChatPage() {
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME_MESSAGE }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  
  // Session states
  const [sessions, setSessions] = useState([])
  const [currentSessionId, setCurrentSessionId] = useState(null)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  const messagesEndRef = useRef(null)
  const prefillConsumedRef = useRef(false)
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition()

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  // Load list of sessions
  const loadSessions = async () => {
    if (!user.user_id) return
    try {
      const res = await api.get(`/api/chat/sessions/${user.user_id}`)
      setSessions(res.data || [])
    } catch (e) {
      console.error('Error loading sessions:', e)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [user.user_id])

  // Load a specific session
  const loadSessionHistory = async (sessionId) => {
    try {
      setLoading(true)
      const res = await api.get(`/api/chat/session/${sessionId}`)
      const logs = res.data || []
      const restored = [{ role: 'bot', text: WELCOME_MESSAGE }]
      logs.forEach((log) => {
        restored.push({ role: 'user', text: log.user_message })
        restored.push({ role: 'bot', text: log.ai_response })
      })
      setMessages(restored)
      setCurrentSessionId(sessionId)
      setIsSidebarOpen(false) // Close sidebar on mobile after selecting
    } catch (e) {
      console.error('Error loading session:', e)
    } finally {
      setLoading(false)
    }
  }

  const createNewSession = () => {
    setCurrentSessionId(null)
    setMessages([{ role: 'bot', text: WELCOME_MESSAGE }])
    setIsSidebarOpen(false)
  }

  useEffect(() => {
    if (prefillConsumedRef.current) return
    const prefilled = location.state?.prefilledMessage
    if (prefilled && typeof prefilled === 'string') {
      prefillConsumedRef.current = true
      setInput(prefilled)
      if (location.state?.fromRiskAssessment) {
        setMessages((prev) => [
          ...prev,
          {
            role: 'bot',
            text: 'Tôi đã nhận kết quả tầm soát của bạn. Bạn có thể chỉnh sửa tin nhắn bên dưới rồi nhấn Gửi để được tư vấn chi tiết hơn.',
          },
        ])
      }
    }
  }, [location.state])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  const sendMessage = async (e, textOverride = null) => {
    if (e) e.preventDefault()
    const textToSend = textOverride || input
    if (!textToSend.trim() || loading) return

    const text = textToSend.trim()
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    resetTranscript()
    setLoading(true)

    try {
      const response = await api.post('/api/chat', {
        user_id: user.user_id,
        message: text,
        chat_type: 'general',
        session_id: currentSessionId
      })
      setMessages((prev) => [...prev, { role: 'bot', text: response.data.reply }])
      
      if (!currentSessionId && response.data.session_id) {
        setCurrentSessionId(response.data.session_id)
        loadSessions() // Refresh sidebar list
      }
    } catch (err) {
      const detail = err.response?.data?.detail
      const fallback = !err.response
        ? 'Không kết nối server. Chạy backend port 8000 và kiểm tra GEMINI_API_KEY.'
        : detail || 'Xin lỗi, Bác sĩ AI đang gặp sự cố. Vui lòng thử lại.'
      setMessages((prev) => [...prev, { role: 'bot', text: fallback }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const feature = getFeatureById('chat')

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] md:h-[calc(100vh-130px)] max-w-6xl mx-auto animate-fade-in relative px-2 md:px-0">
      <div className="flex-1 flex gap-4 overflow-hidden min-h-0 relative mt-2 md:mt-4">
        
        {/* Sidebar for Sessions */}
        <div className={`
          absolute md:static top-0 left-0 h-full w-72 md:w-64 lg:w-72 bg-white md:bg-white/80 md:backdrop-blur-sm z-20 
          transition-transform duration-300 ease-in-out border border-slate-200/80 rounded-2xl p-4 flex flex-col overflow-hidden shadow-xl md:shadow-sm
          ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
        `}>
          <div className="flex justify-between items-center mb-4 pb-2 border-b border-slate-100 shrink-0">
            <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
              <MessageSquare size={18} className="text-brand-600" />
              Lịch sử trò chuyện
            </h3>
            {/* Show close button on mobile */}
            <button 
              onClick={() => setIsSidebarOpen(false)} 
              className="md:hidden p-1.5 text-slate-500 hover:text-slate-800 rounded-lg hover:bg-slate-100"
            >
              <X size={18} />
            </button>
          </div>
          
          <button 
            onClick={createNewSession}
            className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-xl mb-4 flex items-center justify-center gap-2 transition-colors shrink-0 shadow-sm"
          >
            <Plus size={18} /> Cuộc trò chuyện mới
          </button>
          
          <div className="flex-1 overflow-y-auto space-y-1.5 -mr-1 pr-1 custom-scrollbar">
            {sessions.length === 0 ? (
              <p className="text-center text-xs text-slate-500 italic mt-6">Chưa có lịch sử trò chuyện</p>
            ) : (
              sessions.map((s) => (
                <div 
                  key={s.session_id} 
                  onClick={() => loadSessionHistory(s.session_id)} 
                  className={`p-3 rounded-xl cursor-pointer text-xs flex items-center gap-2.5 transition-colors border ${
                    currentSessionId === s.session_id 
                      ? 'bg-brand-50 text-brand-700 font-semibold border-brand-100 shadow-sm' 
                      : 'hover:bg-slate-50 text-slate-600 border-transparent'
                  }`}
                  title={s.title}
                >
                  <MessageSquare size={15} className={currentSessionId === s.session_id ? "text-brand-500 shrink-0" : "text-slate-400 shrink-0"} />
                  <span className="truncate flex-1">{s.title}</span>
                </div>
              ))
            )}
          </div>
        </div>
        
        {/* Mobile overlay */}
        {isSidebarOpen && (
          <div 
            className="absolute inset-0 bg-slate-900/30 z-10 md:hidden backdrop-blur-sm transition-opacity" 
            onClick={() => setIsSidebarOpen(false)}
          />
        )}

        {/* Main Chat Area */}
        <div className="flex-1 flex flex-col border border-slate-200/80 rounded-2xl overflow-hidden min-h-0 bg-white shadow-sm z-0">
          
          {/* Header Bar */}
          <div className="px-4 py-3 border-b border-slate-200 bg-gradient-to-r from-brand-50/50 to-white flex items-center justify-between text-sm text-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <button 
                type="button"
                className="md:hidden p-2 -ml-1.5 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
                onClick={() => setIsSidebarOpen(true)}
              >
                <Menu size={20} />
              </button>
              
              {/* Doctor Status / Title */}
              <div className="flex items-center gap-2">
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-brand-50 border border-brand-100 flex items-center justify-center text-brand-600">
                    <Sparkles className="w-5 h-5 text-brand-600 animate-pulse" />
                  </div>
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white animate-ping" />
                  <span className="absolute bottom-0 right-0 block h-2.5 w-2.5 rounded-full bg-emerald-500 ring-2 ring-white" />
                </div>
                <div>
                  <h2 className="font-bold text-slate-800 leading-tight text-sm sm:text-base">Trợ lý Bác sĩ AI</h2>
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-semibold mt-0.5">
                    <span>Đang hoạt động</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Back to dashboard */}
            <div className="flex items-center gap-2">
              {currentSessionId && (
                <span className="hidden sm:inline-block text-[11px] font-mono text-slate-400 bg-slate-50 px-2 py-0.5 rounded-full border border-slate-200">
                  ID: {currentSessionId.split('-')[0]}
                </span>
              )}
              <Link
                to="/dashboard"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-xs font-bold text-slate-600 transition-colors shadow-sm"
              >
                <ArrowLeft size={14} className="text-slate-500" />
                <span className="hidden sm:inline">Về hệ sinh thái</span>
              </Link>
            </div>
          </div>

          {/* Conversation Log */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/20 flex flex-col">
            {messages.length === 1 && messages[0].role === 'bot' && messages[0].text === WELCOME_MESSAGE ? (
              // Welcome Panel
              <div className="my-auto py-4 px-2 w-full max-w-xl mx-auto space-y-6 animate-fade-in flex flex-col items-center">
                {/* Mascot Icon */}
                <div className="inline-flex p-4 rounded-3xl bg-brand-50 border border-brand-100 shadow-sm relative">
                  <Sparkles className="w-8 h-8 text-brand-600 animate-pulse" />
                  <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-emerald-500"></span>
                  </span>
                </div>

                {/* Title & Introduction */}
                <div className="text-center">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-800">Trợ lý Bác sĩ AI</h3>
                  <p className="text-xs sm:text-sm text-slate-500 mt-2 max-w-sm mx-auto leading-relaxed">
                    Hệ thống tư vấn y tế hoạt động 24/7. Trò chuyện trực tiếp hoặc sử dụng giọng nói để nhận tư vấn sức khỏe tim mạch và đột quỵ.
                  </p>
                </div>

                {/* Suggested Prompts Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full pt-2">
                  {[
                    {
                      title: "Giảm rủi ro đột quỵ",
                      desc: "Cách phòng ngừa đột quỵ hiệu quả ở người cao tuổi?",
                      prompt: "Tôi muốn tìm hiểu các biện pháp hiệu quả để giảm nguy cơ đột quỵ ở người lớn tuổi."
                    },
                    {
                      title: "Huyết áp & Dinh dưỡng",
                      desc: "Chế độ ăn phù hợp cho người bị cao huyết áp?",
                      prompt: "Người bị cao huyết áp nên ăn uống như thế nào để giữ huyết áp ổn định?"
                    },
                    {
                      title: "Chỉ số Cholesterol",
                      desc: "Làm thế nào để kiểm soát mỡ máu cao?",
                      prompt: "Chỉ số cholesterol cao có nguy hiểm không và làm sao để giảm mỡ máu chủ động?"
                    },
                    {
                      title: "Cảnh báo Đau thắt ngực",
                      desc: "Nhận biết cơn đau thắt ngực nguy hiểm?",
                      prompt: "Những biểu hiện đau thắt ngực nào cảnh báo cơn đau tim và cần đi cấp cứu ngay?"
                    }
                  ].map((item, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => sendMessage(null, item.prompt)}
                      className="p-3 rounded-xl border border-slate-200/80 bg-white hover:border-brand-500 hover:bg-brand-50/20 text-left transition-all duration-200 group shadow-sm hover:shadow-md"
                    >
                      <p className="font-bold text-xs text-brand-700 flex items-center gap-1.5 mb-0.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-500 group-hover:scale-110 transition-transform" />
                        {item.title}
                      </p>
                      <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">{item.desc}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, idx) => (
                  <div
                    key={idx}
                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div
                      className={`max-w-[88%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-[15px] leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-brand-600 text-white rounded-br-md shadow-sm'
                          : 'bg-white border border-slate-200 text-slate-800 rounded-bl-md shadow-sm'
                      }`}
                    >
                      {msg.role === 'bot' && (
                        <span className="block text-xs font-semibold text-brand-600 mb-1">
                          Bác sĩ AI
                        </span>
                      )}
                      {msg.text}
                    </div>
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md text-slate-500 text-sm flex items-center gap-2 shadow-sm">
                      <Sparkles className="w-4 h-4 animate-pulse text-brand-500" />
                      Bác sĩ AI đang suy nghĩ...
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          {/* Form Input Section */}
          <form
            onSubmit={sendMessage}
            className="p-3 sm:p-4 border-t border-slate-100 bg-white shrink-0"
          >
            <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20 transition-all shadow-inner">
              {browserSupportsSpeechRecognition && (
                <button
                  type="button"
                  onClick={
                    listening
                      ? SpeechRecognition.stopListening
                      : () => SpeechRecognition.startListening({ language: 'vi-VN' })
                  }
                  className={`p-2.5 rounded-lg shrink-0 transition-colors ${
                    listening
                      ? 'bg-red-100 text-red-600 shadow-sm'
                      : 'bg-white border border-slate-200 text-slate-500 hover:text-brand-600 hover:bg-slate-100'
                  }`}
                  title="Nhập bằng giọng nói"
                >
                  {listening ? <Mic size={22} /> : <MicOff size={22} />}
                </button>
              )}
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Hỏi Bác sĩ AI... (Enter để gửi)"
                rows={1}
                disabled={loading}
                className="flex-1 bg-transparent px-2 py-2.5 text-[15px] outline-none resize-none min-h-[44px] max-h-32 disabled:opacity-60"
              />
              <button
                type="submit"
                disabled={loading || !input.trim()}
                className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shrink-0 disabled:opacity-50 transition-colors shadow-sm"
                title="Gửi tin nhắn"
              >
                <Send size={22} />
              </button>
            </div>
            <div className="text-center mt-2">
              <span className="text-[11px] text-slate-400">AI có thể mắc sai lầm. Hãy kiểm tra lại các thông tin y khoa quan trọng trước khi áp dụng.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
