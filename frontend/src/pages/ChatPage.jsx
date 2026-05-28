import React, { useState, useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import api from '../api/axios'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import { Mic, MicOff, Send, Sparkles } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'

const WELCOME_MESSAGE =
  'Xin chào! Tôi là Bác sĩ AI của SmartHealthcare. Bạn có thể hỏi về huyết áp, cholesterol, chế độ ăn, triệu chứng tim mạch hoặc cách phòng ngừa đột quỵ.'

export default function ChatPage() {
  const location = useLocation()
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [messages, setMessages] = useState([{ role: 'bot', text: WELCOME_MESSAGE }])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [historyLoaded, setHistoryLoaded] = useState(false)
  const messagesEndRef = useRef(null)
  const prefillConsumedRef = useRef(false)
  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition()

  useEffect(() => {
    if (transcript) setInput(transcript)
  }, [transcript])

  useEffect(() => {
    const loadHistory = async () => {
      if (!user.user_id || historyLoaded) return
      try {
        const response = await api.get(`/api/chat/logs/${user.user_id}?limit=20`)
        const logs = response.data || []
        if (logs.length > 0) {
          const restored = [{ role: 'bot', text: WELCOME_MESSAGE }]
          logs.forEach((log) => {
            restored.push({ role: 'user', text: log.user_message })
            restored.push({ role: 'bot', text: log.ai_response })
          })
          setMessages(restored)
        }
      } catch {
        /* giữ welcome mặc định */
      } finally {
        setHistoryLoaded(true)
      }
    }
    loadHistory()
  }, [user.user_id, historyLoaded])

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

  const sendMessage = async (e) => {
    if (e) e.preventDefault()
    if (!input.trim() || loading) return

    const text = input.trim()
    setMessages((prev) => [...prev, { role: 'user', text }])
    setInput('')
    resetTranscript()
    setLoading(true)

    try {
      const response = await api.post('/api/chat', {
        user_id: user.user_id,
        message: text,
        chat_type: 'general',
      })
      setMessages((prev) => [...prev, { role: 'bot', text: response.data.reply }])
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
    <div className="flex flex-col h-[calc(100vh-120px)] sm:h-[calc(100vh-140px)] max-w-4xl mx-auto animate-fade-in">
      <div className="mb-4 shrink-0 space-y-4">
        <FeaturePageBanner feature={feature} />
        <PageHeader
          title="Trợ lý Bác sĩ AI"
          description="Chuyên gia ảo hỗ trợ giải đáp các vấn đề về tim mạch, dinh dưỡng và phòng ngừa đột quỵ. Vui lòng nhập câu hỏi hoặc sử dụng Micro để bắt đầu trò chuyện."
        />
      </div>

      <div className="alert-warning text-sm shrink-0 mb-4 py-3">
        AI chỉ mang tính tham khảo. Với triệu chứng nghiêm trọng, hãy gặp bác sĩ hoặc gọi 115.
      </div>

      <div className="flex-1 flex flex-col section-card p-0 overflow-hidden min-h-0">
        <div className="px-4 py-2 border-b border-slate-100 bg-brand-50/80 flex items-center gap-2 text-sm text-brand-800">
          <Sparkles className="w-4 h-4 shrink-0" />
          <span>Đang kết nối Bác sĩ AI (API /api/chat)</span>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 bg-slate-50/50">
          {messages.map((msg, idx) => (
            <div
              key={idx}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[88%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-base leading-relaxed whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-md'
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
              <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-md text-slate-500 text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 animate-pulse text-brand-500" />
                Bác sĩ AI đang trả lời...
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <form
          onSubmit={sendMessage}
          className="p-4 border-t border-slate-200 bg-white shrink-0"
        >
          <div className="flex items-end gap-2 bg-slate-50 rounded-xl border border-slate-200 p-2 focus-within:border-brand-500 focus-within:ring-2 focus-within:ring-brand-500/20">
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
                    ? 'bg-red-100 text-red-600'
                    : 'bg-white border border-slate-200 text-slate-500 hover:text-brand-600'
                }`}
                title="Giọng nói"
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
              className="flex-1 bg-transparent px-2 py-2.5 text-base outline-none resize-none min-h-[44px] max-h-28 disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="p-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-lg shrink-0 disabled:opacity-50 transition-colors"
              title="Gửi"
            >
              <Send size={22} />
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
