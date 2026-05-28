import React, { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import { Mic, MicOff, ImagePlus, X, Sparkles, Eye } from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'
import { resizeImageFile } from '../utils/imageResize'

const TIPS = [
  'Uống đủ nước (1,5–2 lít/ngày)',
  'Tăng cường rau xanh, củ quả và ngũ cốc nguyên hạt',
  'Hạn chế chất béo bão hòa, thịt đỏ, thức ăn nhanh',
  'Ăn nhạt, giảm muối và đường tinh luyện',
  'Ưu tiên dầu thực vật (olive, đậu nành)',
]

const HISTORY_KEY = 'diet_history'

export default function DietAnalyzerPage() {
  const userStr = localStorage.getItem('user')
  const user = userStr ? JSON.parse(userStr) : {}
  const fileInputRef = useRef(null)

  const [food, setFood] = useState('')
  const [result, setResult] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState([])
  const [mealImage, setMealImage] = useState(null)
  const [showImageModal, setShowImageModal] = useState(false)
  const [dragActive, setDragActive] = useState(false)

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition()

  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch {
      setHistory([])
    }
  }, [])

  useEffect(() => {
    if (transcript) setFood(transcript)
  }, [transcript])

  const saveToHistory = (entry) => {
    const updated = [entry, ...history].slice(0, 8)
    setHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  // Hàm xử lý Drag & Drop
  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setDragActive(true)
    } else if (e.type === 'dragleave') {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)

    const files = e.dataTransfer?.files
    if (files && files.length > 0) {
      const file = files[0]
      processImageFile(file)
    }
  }

  const processImageFile = async (file) => {
    // Kiểm tra loại file
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Định dạng không hỗ trợ. Vui lòng chọn JPG, PNG hoặc WebP.')
      return
    }

    // Kiểm tra kích thước
    if (file.size > 8 * 1024 * 1024) {
      setError('Ảnh quá lớn. Vui lòng chọn file dưới 8MB.')
      return
    }

    setError('')

    try {
      const resized = await resizeImageFile(file)
      setMealImage({
        dataUrl: resized.dataUrl,
        base64: resized.base64,
        mime: resized.mime,
        name: file.name,
      })
    } catch (err) {
      setError(err.message || 'Không xử lý được ảnh.')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0]
    if (file) {
      processImageFile(file)
    }
  }

  const clearImage = () => {
    setMealImage(null)
    setShowImageModal(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const canSubmit = Boolean(food.trim() || mealImage)

  const handleAnalyze = async (e) => {
    e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setResult(null)
    setError('')

    const description = food.trim()
    const base64Data = mealImage?.base64 || ""

    // ✓ Chỉ chặn nếu KHÔNG có description VÀ KHÔNG có ảnh
    // ✓ Nếu chỉ có ảnh (không có text) → vẫn gửi lên Backend
    if (!description && !base64Data) {
      setError('Vui lòng nhập mô tả hoặc tải ảnh bữa ăn.')
      setLoading(false)
      return
    }

    try {
      // ✓ Payload khớp 100% với Backend Model: { description: str, image_base64: str }
      const payload = {
        description: description || "",
        image_base64: base64Data || ""
      }

      const response = await api.post('/api/analyze-meal', payload)
      const reply = response.data.reply

      setResult({
        text: reply,
        analyzedAt: response.data.timestamp || new Date().toISOString(),
        hadImage: Boolean(mealImage),
        mealImage: mealImage?.dataUrl,
      })

      saveToHistory({
        id: Date.now(),
        timestamp: new Date().toISOString(),
        food: description || '(Phân tích từ ảnh)',
        analysis: reply.length > 120 ? `${reply.slice(0, 120)}...` : reply,
        imagePreview: mealImage?.dataUrl || null,
      })

      setFood('')
      clearImage()
      resetTranscript()
    } catch (err) {
      const detail = err.response?.data?.detail
      if (!err.response) {
        setError(
          'Không kết nối được server. Hãy chạy: uvicorn main:app --reload --port 8000'
        )
      } else {
        setError(
          detail || 'Không thể phân tích. Kiểm tra GEMINI_API_KEY trong backend/.env'
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const feature = getFeatureById('diet')

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-5xl mx-auto">
      <FeaturePageBanner feature={feature} />
      <PageHeader
        title="Phân tích bữa ăn"
        description="AI Vision (Gemini) phân tích mô tả hoặc ảnh món ăn — đánh giá mỡ, cholesterol, đường và nguy cơ tim mạch."
      />

      <div className="alert-info text-sm flex items-start gap-2">
        <Sparkles className="w-5 h-5 shrink-0 text-brand-600 mt-0.5" />
        <span>
          Bác sĩ AI sẽ trả lời sau khi bạn gửi. Có thể <strong>gõ mô tả</strong>,{' '}
          <strong>nói giọng nói</strong> hoặc <strong>tải ảnh bữa ăn</strong> (hoặc kết hợp cả ba).
        </span>
      </div>

      <div className="section-card">
        <form onSubmit={handleAnalyze} className="space-y-5">
          <div>
            <label htmlFor="food" className="label-field text-lg">
              Hôm nay bạn ăn gì?
            </label>
            <p className="text-slate-500 text-sm mb-3">
              Ví dụ: 1 bát phở bò, 1 ly cà phê đen, 2 quả trứng luộc...
            </p>
            <textarea
              id="food"
              value={food}
              onChange={(e) => setFood(e.target.value)}
              placeholder="Mô tả bữa ăn của bạn..."
              rows={4}
              disabled={loading}
              className="input-field resize-none"
            />
          </div>

          {/* Khu vực tải ảnh với Drag & Drop */}
          <div>
            <label className="label-field">Ảnh bữa ăn (tùy chọn)</label>
            <p className="text-slate-500 text-sm mb-3">
              Tải ảnh để Gemini Vision nhận diện món và phân tích dinh dưỡng trực quan.
            </p>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={handleImageSelect}
              disabled={loading}
            />

            {!mealImage ? (
              <div
                onDragEnter={handleDrag}
                onDragLeave={handleDrag}
                onDragOver={handleDrag}
                onDrop={handleDrop}
                className={`w-full border-2 border-dashed rounded-xl py-8 px-4 flex flex-col items-center gap-2 cursor-pointer transition-all ${
                  dragActive
                    ? 'border-brand-500 bg-brand-50 scale-102'
                    : 'border-slate-300 hover:border-brand-400 hover:bg-brand-50/50'
                } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                onClick={() => !loading && fileInputRef.current?.click()}
              >
                <ImagePlus className="w-10 h-10 text-brand-500" />
                <span className="font-semibold text-slate-700">
                  Kéo thả ảnh hoặc bấm để chọn
                </span>
                <span className="text-xs text-slate-400">JPG, PNG, WebP — tối đa 8MB</span>
              </div>
            ) : (
              <div className="relative rounded-xl border border-slate-200 overflow-hidden bg-slate-50 shadow-sm">
                <img
                  src={mealImage.dataUrl}
                  alt="Bữa ăn đã chọn"
                  className="w-full max-h-72 object-contain mx-auto"
                />
                <div className="absolute top-2 right-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowImageModal(true)}
                    disabled={loading}
                    className="p-2 rounded-full bg-white/90 border border-slate-200 shadow-sm hover:bg-brand-50 hover:text-brand-600 transition-colors"
                    title="Xem toàn bộ ảnh"
                  >
                    <Eye size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={clearImage}
                    disabled={loading}
                    className="p-2 rounded-full bg-white/90 border border-slate-200 shadow-sm hover:bg-red-50 hover:text-red-600 transition-colors"
                    title="Xóa ảnh"
                  >
                    <X size={18} />
                  </button>
                </div>
                <p className="text-xs text-slate-500 px-3 py-2 border-t border-slate-100 truncate">
                  ✓ {mealImage.name}
                </p>
              </div>
            )}
          </div>

          {/* Thông báo lỗi */}
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 text-red-800 px-4 py-3 text-sm flex items-start gap-2">
              <span className="shrink-0 mt-0.5">⚠️</span>
              <div>{error}</div>
            </div>
          )}

          <div className="flex flex-wrap gap-3">
            {browserSupportsSpeechRecognition && (
              <button
                type="button"
                onClick={
                  listening
                    ? SpeechRecognition.stopListening
                    : () => SpeechRecognition.startListening({ language: 'vi-VN' })
                }
                disabled={loading}
                className={`btn-brand-outline min-w-[160px] ${
                  listening ? 'border-red-300 text-red-600 bg-red-50' : ''
                }`}
              >
                {listening ? <Mic size={20} /> : <MicOff size={20} />}
                {listening ? 'Đang nghe...' : 'Giọng nói'}
              </button>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={loading}
              className="btn-brand-outline min-w-[140px]"
            >
              <ImagePlus size={20} />
              Thêm ảnh
            </button>
            <button
              type="submit"
              disabled={loading || !canSubmit}
              className="flex-1 btn-brand min-w-[200px] disabled:opacity-50"
            >
              {loading ? '⏳ Gemini Vision đang phân tích...' : '🔍 Phân tích dinh dưỡng'}
            </button>
          </div>
        </form>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="section-card border-brand-100">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-full bg-brand-100 flex items-center justify-center animate-pulse">
              <Sparkles className="w-5 h-5 text-brand-600" />
            </div>
            <div>
              <p className="font-bold text-slate-800">Gemini Vision đang xử lý...</p>
              <p className="text-sm text-slate-500">Đang phân tích bữa ăn của bạn</p>
            </div>
          </div>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-slate-200 rounded w-full" />
            <div className="h-4 bg-slate-200 rounded w-11/12" />
            <div className="h-4 bg-slate-200 rounded w-4/5" />
          </div>
        </div>
      )}

      {/* Kết quả */}
      {result && !loading && (
        <div className="section-card border-2 border-brand-200 bg-gradient-to-br from-brand-50/50 to-emerald-50/30">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <h2 className="text-xl font-bold text-brand-900">Kết quả từ Bác sĩ AI</h2>
          </div>

          {/* Hiển thị ảnh nếu có */}
          {result.mealImage && (
            <div className="mb-5 rounded-xl overflow-hidden border border-slate-200 shadow-sm">
              <img
                src={result.mealImage}
                alt="Bữa ăn được phân tích"
                className="w-full max-h-48 object-cover"
              />
            </div>
          )}

          {/* Hiển thị phân tích */}
          <div className="bg-white rounded-xl p-5 sm:p-6 border border-brand-100 shadow-sm">
            <p className="whitespace-pre-wrap text-slate-700 leading-relaxed text-base sm:text-lg font-medium">
              {result.text}
            </p>
            <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100">
              <p className="text-xs text-slate-400">
                {new Date(result.analyzedAt).toLocaleString('vi-VN')}
              </p>
              {result.hadImage && (
                <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-1 rounded-full">
                  ✓ Có phân tích ảnh
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Lịch sử */}
        <div className="section-card">
          <div className="flex justify-between items-start gap-4 mb-4">
            <h3 className="text-lg font-bold">Bữa ăn gần đây</h3>
            {history.length > 0 && (
              <button
                type="button"
                onClick={() => {
                  setHistory([])
                  localStorage.removeItem(HISTORY_KEY)
                }}
                className="text-sm text-red-600 font-medium hover:underline"
              >
                Xóa lịch sử
              </button>
            )}
          </div>
          {history.length === 0 ? (
            <p className="text-slate-500 text-center py-6">Chưa có lịch sử phân tích.</p>
          ) : (
            <ul className="space-y-3 max-h-96 overflow-y-auto">
              {history.map((item) => (
                <li
                  key={item.id}
                  className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-50/50 border border-slate-100 hover:border-brand-200 hover:shadow-md transition-all cursor-pointer"
                >
                  {item.imagePreview && (
                    <img
                      src={item.imagePreview}
                      alt=""
                      className="w-full h-32 object-cover rounded-lg mb-2 border border-slate-200 shadow-sm"
                    />
                  )}
                  <p className="text-xs text-slate-500 mb-1">
                    {new Date(item.timestamp).toLocaleString('vi-VN')}
                  </p>
                  <p className="font-semibold text-slate-800">{item.food}</p>
                  <p className="text-sm text-slate-600 mt-1 line-clamp-3">{item.analysis}</p>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Lời khuyên */}
        <div className="section-card bg-gradient-to-br from-emerald-50/50 to-cyan-50/30 border border-emerald-100">
          <h3 className="text-lg font-bold mb-4 text-emerald-900">Thói quen ăn uống tốt</h3>
          <ul className="space-y-3">
            {TIPS.map((tip, idx) => (
              <li key={idx} className="flex gap-3 text-slate-700">
                <span className="text-emerald-600 font-bold shrink-0 text-lg">✓</span>
                <span className="text-sm leading-relaxed">{tip}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Modal Xem ảnh toàn bộ */}
      {showImageModal && mealImage && (
        <div
          className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-white rounded-2xl max-w-2xl w-full overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center p-4 border-b border-slate-200">
              <h2 className="font-bold text-slate-800">{mealImage.name}</h2>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <X size={24} />
              </button>
            </div>
            <img
              src={mealImage.dataUrl}
              alt="Xem toàn bộ"
              className="w-full max-h-[70vh] object-contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
