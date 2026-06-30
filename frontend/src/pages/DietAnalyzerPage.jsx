import React, { useState, useEffect, useRef } from 'react'
import api from '../api/axios'
import SpeechRecognition, { useSpeechRecognition } from 'react-speech-recognition'
import {
  Mic,
  MicOff,
  ImagePlus,
  X,
  Sparkles,
  Eye,
  Utensils,
  Flame,
  Activity,
  ShieldAlert,
  Heart,
  Info,
  TrendingUp,
  Droplets,
  Scale,
  Trash2,
  ArrowRight,
  Check,
  Award,
  ChevronRight,
  BookOpen,
  Bookmark
} from 'lucide-react'
import PageHeader from '../components/PageHeader'
import FeaturePageBanner from '../components/FeaturePageBanner'
import { getFeatureById } from '../data/features'
import { resizeImageFile } from '../utils/imageResize'

/*
  GHI CHÚ VẤN ĐÁP:
  Trang này là module Phân tích dinh dưỡng.
  Input X: mô tả món ăn bằng văn bản, giọng nói hoặc ảnh món ăn.
  Hàm xử lý f:
  - Frontend thu thập mô tả/ảnh, nén ảnh và chuyển ảnh sang base64 nếu có.
  - Gửi dữ liệu đến backend /api/analyze-meal.
  - Backend dùng Vision/Text LLM qua OpenRouter để phân tích món ăn.
  Output y: đánh giá calo, protein, chất béo, đường, muối, chất xơ và lời khuyên tim mạch.
  Ý nghĩa y tế:
  - Dinh dưỡng ảnh hưởng trực tiếp đến huyết áp, cholesterol, cân nặng và nguy cơ tim mạch.
*/

const TIPS = [
  'Uống đủ nước (1,5–2 lít/ngày) để thanh lọc cơ thể.',
  'Tăng cường rau xanh, củ quả và ngũ cốc nguyên hạt.',
  'Hạn chế chất béo bão hòa, thịt mỡ, thức ăn nhanh.',
  'Ăn nhạt, giảm muối (< 5g/ngày) và đường tinh luyện.',
  'Ưu tiên dầu thực vật giàu Omega-3 (olive, đậu nành).',
]

const QUICK_TAGS = [
  { label: '🍲 Phở bò', value: '1 bát phở bò đầy đủ hành trần' },
  { label: '🥗 Salad ức gà', value: '1 đĩa salad ức gà xé phay sốt olive' },
  { label: '🥩 Cơm tấm sườn', value: '1 dĩa cơm tấm sườn nướng trứng ốp la' },
  { label: '🐟 Cá hồi áp chảo', value: 'Cá hồi áp chảo kèm măng tây tây' },
  { label: '☕ Cà phê sữa', value: '1 ly cà phê sữa đá nhiều sữa' },
  { label: '🍎 Hoa quả thập cẩm', value: '1 đĩa táo, chuối và dưa hấu' },
]

const HISTORY_KEY = 'diet_history'

// Hàm bóc tách nội dung AI (Gemini Response Parser)
function parseAIResponse(text) {
  if (!text) return null

  // 1. Phân loại mức độ tim mạch
  let cardioLevel = 'TRUNG BÌNH'
  const upperText = text.toUpperCase()
  if (upperText.includes('TUYỆT VỜI')) cardioLevel = 'TUYỆT VỜI'
  else if (upperText.includes('TỐT')) cardioLevel = 'TỐT'
  else if (upperText.includes('CẦN HẠN CHẾ') || upperText.includes('HẠN CHẾ CỰC ĐỘ') || upperText.includes('CỰC KỲ HẠN CHẾ')) cardioLevel = 'CẦN HẠN CHẾ'
  else if (upperText.includes('CÓ RỦI RO') || upperText.includes('RỦI RO') || upperText.includes('NGUY CƠ')) cardioLevel = 'CÓ RỦI RO'
  else if (upperText.includes('TRUNG BÌNH') || upperText.includes('BÌNH THƯỜNG')) cardioLevel = 'TRUNG BÌNH'

  // 2. Tìm kiếm các thông số dinh dưỡng bằng Regex linh hoạt
  let calo = 0
  const caloMatch = text.match(/(?:calo|calories|kcal|năng lượng)\s*[:\-]?\s*~(\d+)|(?:calo|calories|kcal|năng lượng)\s*[:\-]?\s*(\d+)/i)
  if (caloMatch) {
    calo = parseInt(caloMatch[1] || caloMatch[2] || '0', 10)
  }
  if (!calo) {
    const caloFallback = text.match(/(\d+)\s*(?:kcal|calo|calories)/i)
    if (caloFallback) calo = parseInt(caloFallback[1], 10)
  }

  let protein = 0
  const proteinMatch = text.match(/(?:protein|chất đạm|đạm)\s*\(?g\)?\s*[:\-]?\s*~(\d+(?:\.\d+)?)|(?:protein|chất đạm|đạm)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i)
  if (proteinMatch) {
    protein = parseFloat(proteinMatch[1] || proteinMatch[2] || '0')
  }

  let fat = 0
  const fatMatch = text.match(/(?:chất béo|béo tổng|lipid|fat)\s*\(?g\)?\s*[:\-]?\s*~(\d+(?:\.\d+)?)|(?:chất béo|béo tổng|lipid|fat)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i)
  if (fatMatch) {
    fat = parseFloat(fatMatch[1] || fatMatch[2] || '0')
  }

  let carbs = 0
  const carbsMatch = text.match(/(?:carbohydrate|carb|glucid|tinh bột|đường)\s*\(?g\)?\s*[:\-]?\s*~(\d+(?:\.\d+)?)|(?:carbohydrate|carb|glucid|tinh bột|đường)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i)
  if (carbsMatch) {
    carbs = parseFloat(carbsMatch[1] || carbsMatch[2] || '0')
  }

  let sodium = 0
  const sodiumMatch = text.match(/(?:muối|sodium|natri)\s*\(?mg\)?\s*[:\-]?\s*~(\d+(?:\.\d+)?)|(?:muối|sodium|natri)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*mg/i)
  if (sodiumMatch) {
    sodium = parseFloat(sodiumMatch[1] || sodiumMatch[2] || '0')
  } else {
    const sodiumG = text.match(/(?:muối|sodium|natri)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i)
    if (sodiumG) sodium = parseFloat(sodiumG[1]) * 1000
  }

  let fiber = 0
  const fiberMatch = text.match(/(?:chất xơ|xơ)\s*\(?g\)?\s*[:\-]?\s*~(\d+(?:\.\d+)?)|(?:chất xơ|xơ)\s*[:\-]?\s*(\d+(?:\.\d+)?)\s*g/i)
  if (fiberMatch) {
    fiber = parseFloat(fiberMatch[1] || fiberMatch[2] || '0')
  }

  // 3. Trích xuất danh sách lời khuyên (lấy các dòng có gạch đầu dòng dưới mục Lời khuyên hoặc từ cuối bài)
  const recommendations = []
  const lines = text.split('\n')
  let startRec = false

  for (const line of lines) {
    const trimmed = line.trim()
    if (trimmed.match(/(?:lời khuyên|khuyến nghị|cải thiện|thay thế|lưu ý)/i) && (trimmed.includes('4.') || trimmed.includes('Lời khuyên') || trimmed.includes('khuyến nghị'))) {
      startRec = true
      continue
    }
    if (startRec && trimmed.match(/^[1-3]\./)) {
      startRec = false
    }
    if (startRec && trimmed.match(/^[-*•]\s+(.+)/)) {
      recommendations.push(trimmed.replace(/^[-*•]\s+/, ''))
    } else if (startRec && trimmed.match(/^\d+\.\s*(.+)/)) {
      recommendations.push(trimmed.replace(/^\d+\.\s*/, ''))
    }
  }

  // Dự phòng nếu không trích xuất được list lời khuyên nào
  const defaultRecs = [
    'Ăn chậm nhai kỹ, kiểm soát kích cỡ phần ăn phù hợp.',
    'Bổ sung thêm rau quả tươi trước bữa ăn chính để tăng xơ hòa tan.',
    'Hạn chế tối đa nước dùng béo, nước sốt sệt nhiều muối.',
    'Uống nhiều nước lọc thay vì đồ uống có đường sau ăn.'
  ]

  return {
    cardioLevel,
    calo: calo || 380, // giá trị mặc định ước lượng
    protein: protein || 18,
    fat: fat || 14,
    carbs: carbs || 46,
    sodium: sodium || 480,
    fiber: fiber || 3.2,
    recommendations: recommendations.length > 0 ? recommendations.slice(0, 5) : defaultRecs
  }
}

const CARDIO_THEMES = {
  'TUYỆT VỜI': {
    title: 'Tuyệt vời',
    colorClass: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    gaugeColor: 'bg-emerald-500',
    percentage: 95,
    icon: Check,
    desc: 'Bữa ăn lành mạnh, bảo vệ thành mạch và kiểm soát tốt huyết áp.'
  },
  'TỐT': {
    title: 'Tốt',
    colorClass: 'text-green-700 bg-green-50 border-green-200',
    gaugeColor: 'bg-green-500',
    percentage: 75,
    icon: Heart,
    desc: 'Lựa chọn dinh dưỡng an toàn cho tim mạch, ít chất béo bão hòa.'
  },
  'TRUNG BÌNH': {
    title: 'Trung bình',
    colorClass: 'text-amber-700 bg-amber-50 border-amber-200',
    gaugeColor: 'bg-amber-500',
    percentage: 50,
    icon: Info,
    desc: 'Có một số thành phần chưa tối ưu (muối/đường), nên bổ sung rau xanh.'
  },
  'CÓ RỦI RO': {
    title: 'Có rủi ro',
    colorClass: 'text-orange-700 bg-orange-50 border-orange-200',
    gaugeColor: 'bg-orange-500',
    percentage: 25,
    icon: ShieldAlert,
    desc: 'Nên hạn chế ăn thường xuyên do nhiều dầu mỡ bão hòa hoặc đường.'
  },
  'CẦN HẠN CHẾ': {
    title: 'Cần hạn chế',
    colorClass: 'text-red-700 bg-red-50 border-red-200',
    gaugeColor: 'bg-red-500',
    percentage: 10,
    icon: X,
    desc: 'Nguy cơ cao tăng cholesterol và huyết áp. Nên thay bằng chế độ ăn thanh đạm hơn.'
  }
}

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
  const [imageHint, setImageHint] = useState('')
  const [showHintModal, setShowHintModal] = useState(false)
  const [dragActive, setDragActive] = useState(false)
  const [activeTab, setActiveTab] = useState('input') // 'input' hoặc 'result' (Dành cho Mobile)
  const [resultTab, setResultTab] = useState('metrics') // 'metrics' | 'commentary' | 'recommendations'

  // Các Widget States
  const [waterIntake, setWaterIntake] = useState(0)
  const WATER_GOAL = 2000

  const [weight, setWeight] = useState('')
  const [gender, setGender] = useState('male')
  const [activity, setActivity] = useState('moderate')
  const [calcCalories, setCalcCalories] = useState(null)
  const [checkedRecs, setCheckedRecs] = useState({})

  const { transcript, listening, resetTranscript, browserSupportsSpeechRecognition } =
    useSpeechRecognition()

  // Đồng bộ lịch sử & nước từ localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem(HISTORY_KEY)
      if (saved) setHistory(JSON.parse(saved))
    } catch {
      setHistory([])
    }

    // Load nhật ký nước uống theo ngày
    try {
      const savedWater = localStorage.getItem('diet_water_intake')
      const savedWaterDate = localStorage.getItem('diet_water_date')
      const todayStr = new Date().toDateString()
      if (savedWater && savedWaterDate === todayStr) {
        setWaterIntake(parseInt(savedWater, 10))
      } else {
        setWaterIntake(0)
        localStorage.setItem('diet_water_intake', '0')
        localStorage.setItem('diet_water_date', todayStr)
      }
    } catch {
      setWaterIntake(0)
    }
  }, [])

  useEffect(() => {
    if (transcript) setFood(transcript)
  }, [transcript])

  // Lưu lịch sử phân tích
  const saveToHistory = (entry) => {
    const updated = [entry, ...history].slice(0, 8)
    setHistory(updated)
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated))
  }

  // Tương tác nước uống
  const handleAddWater = (amount) => {
    const newIntake = Math.min(waterIntake + amount, 4000)
    setWaterIntake(newIntake)
    localStorage.setItem('diet_water_intake', newIntake.toString())
    localStorage.setItem('diet_water_date', new Date().toDateString())
  }

  const handleResetWater = () => {
    setWaterIntake(0)
    localStorage.setItem('diet_water_intake', '0')
  }

  // Tính calorie khuyến nghị
  const handleCalculateCalories = (e) => {
    e.preventDefault()
    const w = parseFloat(weight)
    if (!w || isNaN(w)) return

    let factor = 1.3 // trung bình
    if (activity === 'sedentary') factor = 1.15
    if (activity === 'active') factor = 1.55

    const base = gender === 'male' ? w * 24 : w * 22
    const target = Math.round(base * factor)
    setCalcCalories({
      min: target - 150,
      max: target + 150,
      target
    })
  }

  // Xử lý kéo thả ảnh
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
      processImageFile(files[0])
    }
  }

  const processImageFile = async (file) => {
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      setError('Định dạng không hỗ trợ. Vui lòng chọn JPG, PNG hoặc WebP.')
      return
    }
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
      setImageHint('')
      setShowHintModal(true)
    } catch (err) {
      setError(err.message || 'Không xử lý được ảnh.')
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleImageSelect = (e) => {
    const file = e.target.files?.[0]
    if (file) processImageFile(file)
  }

  const clearImage = () => {
    setMealImage(null)
    setImageHint('')
    setShowImageModal(false)
    setShowHintModal(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // Tải lại kết quả từ Lịch sử
  const handleReloadHistory = (item) => {
    setResult({
      text: item.analysis,
      analyzedAt: item.timestamp,
      hadImage: Boolean(item.imagePreview),
      mealImage: item.imagePreview,
    })
    setCheckedRecs({})
    setResultTab('metrics')
    // Chuyển tab sang cột kết quả trên mobile
    setActiveTab('result')
  }

  const canSubmit = Boolean(food.trim() || mealImage)

  const handleAnalyze = async (e) => {
    if (e) e.preventDefault()
    if (!canSubmit) return

    setLoading(true)
    setResult(null)
    setError('')
    setCheckedRecs({})

    let description = food.trim()
    if (mealImage && imageHint.trim()) {
      description = `${description ? description + '\n' : ''}Món ăn trong ảnh: ${imageHint.trim()}`.trim()
    }
    const base64Data = mealImage?.base64 || ''

    if (!description && !base64Data) {
      setError('Vui lòng nhập mô tả hoặc tải ảnh bữa ăn.')
      setLoading(false)
      return
    }

    try {
      const payload = {
        description: description || '',
        image_base64: base64Data || '',
        image_name: mealImage?.name || ''
      }

      const response = await api.post('/api/analyze-meal', payload)
      const reply = response.data.reply

      const nextResult = {
        text: reply,
        analyzedAt: response.data.timestamp || new Date().toISOString(),
        hadImage: Boolean(mealImage),
        mealImage: mealImage?.dataUrl,
      }

      setResult(nextResult)
      setResultTab('metrics')

      saveToHistory({
        id: Date.now(),
        timestamp: nextResult.analyzedAt,
        food: description || '(Phân tích từ ảnh)',
        analysis: reply,
        imagePreview: mealImage?.dataUrl || null,
      })

      setFood('')
      clearImage()
      resetTranscript()
      // Chuyển sang xem tab kết quả
      setActiveTab('result')
    } catch (err) {
      const detail = err.response?.data?.detail
      if (!err.response) {
        setError('Không kết nối được server. Hãy chạy: uvicorn main:app --reload --port 8000')
      } else {
        setError(detail || 'Không thể phân tích. Kiểm tra GEMINI_API_KEY trong backend/.env')
      }
    } finally {
      setLoading(false)
    }
  }

  // Hàm hiển thị định dạng nội dung Markdown đơn giản
  const renderMarkdown = (txt) => {
    if (!txt) return null
    return txt.split('\n').map((line, index) => {
      const trimmed = line.trim()
      if (!trimmed) return <div key={index} className="h-2" />

      if (trimmed.startsWith('### ')) {
        return (
          <h4 key={index} className="text-base font-bold text-slate-800 mt-4 mb-1 border-l-4 border-brand-500 pl-2">
            {trimmed.replace('### ', '')}
          </h4>
        )
      }
      if (trimmed.startsWith('## ') || trimmed.startsWith('2. **') || trimmed.startsWith('3. **') || trimmed.startsWith('4. **') || trimmed.startsWith('1. **')) {
        let cleanText = trimmed.replace(/^##\s+/, '')
        if (cleanText.startsWith('1. **') || cleanText.startsWith('2. **') || cleanText.startsWith('3. **') || cleanText.startsWith('4. **')) {
          cleanText = cleanText.replace(/^\d+\.\s*\*\*/, '').replace(/\*\*$/, '')
        }
        return (
          <h3 key={index} className="text-lg font-bold text-slate-900 mt-5 mb-2 flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 shrink-0" />
            {cleanText}
          </h3>
        )
      }

      if (trimmed.startsWith('- ') || trimmed.startsWith('* ') || trimmed.startsWith('• ')) {
        const cleanText = trimmed.replace(/^[-*•]\s+/, '')
        return (
          <li key={index} className="ml-4 list-disc text-slate-600 my-1 leading-relaxed">
            {parseBoldText(cleanText)}
          </li>
        )
      }

      return (
        <p key={index} className="text-slate-600 leading-relaxed my-2 text-sm sm:text-base">
          {parseBoldText(trimmed)}
        </p>
      )
    })
  }

  const parseBoldText = (str) => {
    const parts = str.split(/(\*\*.*?\*\*)/g)
    return parts.map((part, i) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return (
          <strong key={i} className="font-bold text-slate-900">
            {part.slice(2, -2)}
          </strong>
        )
      }
      return part
    })
  }

  // Phân tích kết quả từ text AI
  const parsedMetrics = result ? parseAIResponse(result.text) : null
  const cardioTheme = parsedMetrics ? CARDIO_THEMES[parsedMetrics.cardioLevel] : null
  const CardioIcon = cardioTheme ? cardioTheme.icon : null
  
  // Tính số lượng checklist hoàn tất
  const totalRecs = parsedMetrics?.recommendations?.length || 0
  const completedRecs = Object.values(checkedRecs).filter(Boolean).length

  const feature = getFeatureById('diet')

  return (
    <div className="space-y-6 sm:space-y-8 animate-fade-in max-w-6xl mx-auto px-2 sm:px-4">
      <FeaturePageBanner feature={feature} />
      
      <PageHeader
        title="Dinh dưỡng Chủ động"
        description="Đồng hành cùng Bác sĩ AI (Gemini Vision) nhận diện món ăn qua camera/giọng nói, tính toán calo và chủ động kiểm soát mỡ máu, tim mạch."
      />

      {/* Tab Switcher - Only visible on Mobile */}
      <div className="flex lg:hidden bg-slate-200/60 p-1.5 rounded-2xl gap-1.5">
        <button
          onClick={() => setActiveTab('input')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 ${
            activeTab === 'input'
              ? 'bg-white text-brand-700 shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Utensils size={18} />
          Nhập bữa ăn
        </button>
        <button
          onClick={() => setActiveTab('result')}
          className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold transition-all flex items-center justify-center gap-2 relative ${
            activeTab === 'result'
              ? 'bg-white text-brand-700 shadow-md'
              : 'text-slate-600 hover:text-slate-900'
          }`}
        >
          <Sparkles size={18} />
          Xem kết quả
          {result && (
            <span className="w-2.5 h-2.5 bg-brand-500 rounded-full absolute top-2 right-2 animate-ping" />
          )}
        </button>
      </div>

      {/* Main Responsive Grid Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 sm:gap-8 items-start">
        
        {/* LEFT PANEL: Form + Quick Tags + Trackers */}
        <div className={`lg:col-span-7 space-y-6 ${activeTab === 'input' ? 'block' : 'hidden lg:block'}`}>
          
          {/* Main Form Card */}
          <div className="section-card bg-white/80 backdrop-blur-md border border-slate-200/50 shadow-lg relative overflow-hidden group">
            <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-brand-400 to-emerald-600" />
            
            <form onSubmit={handleAnalyze} className="space-y-6">
              <div>
                <label htmlFor="food" className="flex items-center gap-2 text-lg font-bold text-slate-800">
                  <Utensils className="w-5 h-5 text-brand-500" />
                  Bạn đã ăn những gì hôm nay?
                </label>
                <p className="text-slate-400 text-xs sm:text-sm mt-1 mb-4 leading-relaxed">
                  Nhập mô tả chi tiết, dùng giọng nói hoặc chụp ảnh khay cơm để AI phân tích.
                </p>
                
                <textarea
                  id="food"
                  value={food}
                  onChange={(e) => setFood(e.target.value)}
                  placeholder="Ví dụ: 1 đĩa cơm sườn nhiều nước béo, 1 cốc trà đá ngọt..."
                  rows={4}
                  disabled={loading}
                  className="w-full px-4 py-3 text-base text-slate-800 bg-slate-50/50 border border-slate-200 rounded-2xl placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none shadow-inner"
                />

                {/* Quick tags */}
                <div className="mt-3">
                  <p className="text-slate-400 text-xs font-semibold mb-2">💡 Gợi ý món ăn nhanh:</p>
                  <div className="flex flex-wrap gap-2">
                    {QUICK_TAGS.map((tag, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setFood(tag.value)}
                        disabled={loading}
                        className="text-xs bg-slate-100 hover:bg-brand-50 text-slate-600 hover:text-brand-700 px-3 py-1.5 rounded-full border border-slate-200/60 hover:border-brand-200 transition-all font-medium active:scale-95"
                      >
                        {tag.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Drag & Drop Image Section */}
              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 flex items-center gap-1.5">
                  <ImagePlus className="w-4 h-4 text-brand-500" />
                  Ảnh chụp bữa ăn (Không bắt buộc)
                </label>
                
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
                    onClick={() => !loading && fileInputRef.current?.click()}
                    className={`w-full border-2 border-dashed rounded-2xl py-7 px-4 flex flex-col items-center justify-center gap-2 cursor-pointer transition-all duration-300 ${
                      dragActive
                        ? 'border-brand-500 bg-brand-50/70 scale-102 shadow-md'
                        : 'border-slate-200 hover:border-brand-400 hover:bg-brand-50/30'
                    } ${loading ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="w-12 h-12 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 group-hover:scale-110 transition-transform">
                      <ImagePlus size={24} />
                    </div>
                    <span className="font-bold text-slate-700 text-sm sm:text-base">
                      Kéo thả ảnh hoặc bấm để tải lên
                    </span>
                    <span className="text-xs text-slate-400">JPG, PNG, WebP — tối đa 8MB</span>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="relative rounded-2xl border border-slate-200 overflow-hidden bg-slate-900 shadow-lg group-image">
                      <img
                        src={mealImage.dataUrl}
                        alt="Bữa ăn đã chọn"
                        className="w-full max-h-64 object-contain mx-auto"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-image-hover:opacity-100 transition-opacity flex items-center justify-center gap-3">
                        <button
                          type="button"
                          onClick={() => setShowImageModal(true)}
                          className="p-3 rounded-full bg-white/95 text-slate-800 hover:text-brand-600 transition-colors shadow-lg active:scale-90"
                          title="Xem phóng to"
                        >
                          <Eye size={20} />
                        </button>
                        <button
                          type="button"
                          onClick={clearImage}
                          className="p-3 rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg active:scale-90"
                          title="Xóa ảnh"
                        >
                          <X size={20} />
                        </button>
                      </div>
                      <div className="absolute bottom-0 inset-x-0 bg-black/60 px-4 py-2 text-white text-xs truncate flex items-center justify-between">
                        <span>✓ {mealImage.name}</span>
                        <button type="button" onClick={clearImage} className="text-red-400 hover:text-red-300 font-bold">Xóa</button>
                      </div>
                    </div>
                    
                    {/* Hộp gợi ý nhanh dưới ảnh */}
                    <div className="bg-slate-50 border border-slate-250/60 rounded-2xl p-4 space-y-2">
                      <label htmlFor="hint-inline" className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-brand-500 animate-pulse" />
                        Bạn muốn AI phân tích món gì trong ảnh này? (Gợi ý):
                      </label>
                      <div className="flex gap-2">
                        <input
                          id="hint-inline"
                          type="text"
                          value={imageHint}
                          onChange={(e) => setImageHint(e.target.value)}
                          placeholder="Ví dụ: Đĩa rau muống xào tỏi, 1 đĩa salad..."
                          className="flex-1 px-3 py-2 text-sm text-slate-800 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-brand-500 focus:border-brand-500 transition-all shadow-sm"
                        />
                        <button
                          type="button"
                          onClick={() => setShowHintModal(true)}
                          className="px-3 py-2 bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-slate-650 border border-slate-200 rounded-xl text-xs font-bold transition-all active:scale-95 shrink-0"
                          title="Mở lại hộp thoại gợi ý"
                        >
                          Hộp thoại
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Speech Voice Output Waveform */}
              {listening && (
                <div className="flex items-center gap-3 p-3 bg-red-50/80 border border-red-100 rounded-xl animate-pulse">
                  <div className="flex gap-1 items-end h-6 shrink-0">
                    <span className="w-1.5 h-3 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.1s' }} />
                    <span className="w-1.5 h-6 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                    <span className="w-1.5 h-4 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.3s' }} />
                    <span className="w-1.5 h-5 bg-red-500 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-red-700">
                    Đang thu âm... Bác sĩ đang nghe bạn nói món ăn.
                  </span>
                </div>
              )}

              {error && (
                <div className="rounded-2xl border border-red-100 bg-red-50/80 text-red-800 p-4 text-sm flex items-start gap-3 shadow-sm">
                  <span className="text-base">⚠️</span>
                  <div className="font-medium">{error}</div>
                </div>
              )}

              {/* Submit Buttons */}
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
                    className={`flex-1 sm:flex-initial btn-brand-outline rounded-xl min-h-[48px] px-5 flex items-center justify-center gap-2 border border-slate-200 transition-all font-semibold active:scale-95 ${
                      listening ? 'border-red-500 bg-red-50 text-red-600 hover:bg-red-50' : 'text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {listening ? <Mic className="w-5 h-5 text-red-500 animate-pulse" /> : <MicOff className="w-5 h-5 text-slate-500" />}
                    {listening ? 'Dừng nói' : 'Thu giọng'}
                  </button>
                )}
                
                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="w-full sm:flex-1 btn-brand rounded-xl min-h-[48px] bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 font-bold shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Gemini đang phân tích...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Phân tích Dinh dưỡng AI</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Interactive Water Tracker & Calorie Guide */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Water Tracker Widget */}
            <div className="section-card bg-gradient-to-br from-cyan-50/60 to-blue-50/40 border border-blue-100 shadow-md relative overflow-hidden">
              <div className="absolute top-0 right-0 p-4 opacity-15">
                <Droplets size={70} className="text-blue-500" />
              </div>
              <div className="relative z-10 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="font-bold text-slate-800 flex items-center gap-2">
                    <Droplets className="text-blue-500 w-5 h-5" />
                    Nhật ký uống nước
                  </h3>
                  <button onClick={handleResetWater} className="text-xs text-slate-400 hover:text-red-500 font-medium transition-colors">Đặt lại</button>
                </div>
                
                {/* Visual Water Wave progress */}
                <div className="flex items-center gap-4">
                  <div className="relative w-16 h-16 rounded-full bg-blue-100/60 border border-blue-200 overflow-hidden flex items-center justify-center shrink-0">
                    <div
                      className="absolute bottom-0 inset-x-0 bg-blue-400 transition-all duration-500"
                      style={{ height: `${Math.min((waterIntake / WATER_GOAL) * 100, 100)}%` }}
                    />
                    <span className="relative z-10 text-xs font-black text-blue-900">
                      {Math.round((waterIntake / WATER_GOAL) * 100)}%
                    </span>
                  </div>
                  <div>
                    <p className="text-xl font-black text-slate-800">{waterIntake} <span className="text-sm font-medium text-slate-500">/ {WATER_GOAL} ml</span></p>
                    <p className="text-xs text-slate-500 mt-0.5">Mục tiêu uống đủ nước giúp ngừa đông máu, đột quỵ.</p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleAddWater(250)}
                    className="flex-1 py-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
                  >
                    +250ml (Cốc)
                  </button>
                  <button
                    onClick={() => handleAddWater(500)}
                    className="flex-1 py-2 bg-white hover:bg-blue-50 border border-blue-200 text-blue-700 text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center justify-center gap-1"
                  >
                    +500ml (Chai)
                  </button>
                </div>
              </div>
            </div>

            {/* Quick Calorie Estimator Widget */}
            <div className="section-card bg-gradient-to-br from-amber-50/50 to-orange-50/30 border border-amber-100 shadow-md">
              <h3 className="font-bold text-slate-800 flex items-center gap-2 mb-3">
                <Scale className="text-amber-500 w-5 h-5" />
                Tính Calo khuyến nghị
              </h3>
              
              {!calcCalories ? (
                <form onSubmit={handleCalculateCalories} className="space-y-2.5">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Cân nặng (kg)</label>
                      <input
                        type="number"
                        placeholder="Ví dụ: 65"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                        className="w-full px-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 bg-white"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 uppercase">Giới tính</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 bg-white"
                      >
                        <option value="male">Nam</option>
                        <option value="female">Nữ</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase">Mức độ vận động</label>
                    <select
                      value={activity}
                      onChange={(e) => setActivity(e.target.value)}
                      className="w-full px-2 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:border-brand-500 bg-white"
                    >
                      <option value="sedentary">Ít vận động (làm việc văn phòng)</option>
                      <option value="moderate">Vận động vừa (tập nhẹ 2-3 buổi)</option>
                      <option value="active">Rất năng động (thể thao mỗi ngày)</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-white font-bold rounded-lg text-xs transition-colors shadow-sm"
                  >
                    Tính toán nhu cầu
                  </button>
                </form>
              ) : (
                <div className="space-y-3">
                  <div className="bg-white/80 p-3 rounded-xl border border-amber-200/50">
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Lượng calo cần thiết/ngày</p>
                    <p className="text-lg font-black text-amber-600">{calcCalories.target} kcal</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Phạm vi khuyến nghị: <strong className="text-slate-700">{calcCalories.min} - {calcCalories.max} kcal</strong>
                    </p>
                  </div>
                  <button
                    onClick={() => setCalcCalories(null)}
                    className="w-full py-1 text-center text-xs text-slate-500 hover:text-slate-800 transition-colors font-medium"
                  >
                    ← Tính toán lại
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT PANEL: Result Dashboard & History */}
        <div className={`lg:col-span-5 space-y-6 ${activeTab === 'result' ? 'block' : 'hidden lg:block'}`}>
          
          {/* AI Loader State */}
          {loading && (
            <div className="section-card bg-white border border-slate-200 shadow-xl p-8 flex flex-col items-center justify-center text-center space-y-6 animate-pulse">
              <div className="w-16 h-16 rounded-full bg-brand-50 flex items-center justify-center text-brand-600 relative">
                <div className="absolute inset-0 rounded-full border-4 border-brand-500 border-t-transparent animate-spin" />
                <Sparkles className="w-7 h-7" />
              </div>
              <div className="space-y-2 max-w-xs">
                <h3 className="text-lg font-bold text-slate-800">Bác sĩ AI đang đọc thực đơn...</h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  Đang bóc tách calo, chất béo bão hòa và đánh giá mức độ ảnh hưởng tới tim mạch của bạn.
                </p>
              </div>
              <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                <div className="w-2/3 h-full bg-brand-500 rounded-full animate-infinite-loading" />
              </div>
            </div>
          )}

          {/* AI Result Dashboard */}
          {result && !loading && parsedMetrics && (
            <div className="space-y-6">
              
              {/* Main Result Card */}
              <div className="section-card bg-white/90 backdrop-blur-md border-2 border-brand-100 shadow-xl relative overflow-hidden p-5 sm:p-6 space-y-6">
                
                {/* Banner header result */}
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-2.5">
                    <div className="w-10 h-10 rounded-xl bg-brand-600 text-white flex items-center justify-center shadow-md">
                      <Sparkles className="w-5 h-5" />
                    </div>
                    <div>
                      <h2 className="text-base sm:text-lg font-black text-slate-800">Kết luận từ Bác sĩ AI</h2>
                      <p className="text-[10px] text-slate-400">
                        Phân tích lúc: {new Date(result.analyzedAt).toLocaleString('vi-VN')}
                      </p>
                    </div>
                  </div>
                  
                  {result.hadImage && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-150">
                      Vision
                    </span>
                  )}
                </div>

                {/* Display Analysed Meal Image if present */}
                {result.mealImage && (
                  <div className="rounded-xl overflow-hidden border border-slate-200/60 shadow-sm relative group max-h-36">
                    <img
                      src={result.mealImage}
                      alt="Bữa ăn"
                      className="w-full h-36 object-cover"
                    />
                    <div className="absolute inset-0 bg-black/30 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setShowImageModal(true)}
                        className="bg-white/95 px-3 py-1.5 rounded-lg text-xs font-bold text-slate-700 shadow flex items-center gap-1 active:scale-95"
                      >
                        <Eye size={12} /> Xem ảnh đầy đủ
                      </button>
                    </div>
                  </div>
                )}

                {/* Khung chuyển đổi tab nội dung kết quả */}
                <div className="flex bg-slate-100 p-1.5 rounded-2xl gap-1 border border-slate-200/50">
                  <button
                    type="button"
                    onClick={() => setResultTab('metrics')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      resultTab === 'metrics'
                        ? 'bg-white text-brand-700 shadow-md border border-slate-200/10'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Flame size={14} className="text-orange-500" />
                    Dinh dưỡng
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultTab('commentary')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 ${
                      resultTab === 'commentary'
                        ? 'bg-white text-brand-700 shadow-md border border-slate-200/10'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <BookOpen size={14} className="text-blue-500" />
                    Nhận xét
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultTab('recommendations')}
                    className={`flex-1 py-2 px-3 rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 relative ${
                      resultTab === 'recommendations'
                        ? 'bg-white text-brand-700 shadow-md border border-slate-200/10'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    <Award size={14} className="text-emerald-500" />
                    Khuyến nghị
                    {totalRecs > 0 && completedRecs < totalRecs && (
                      <span className="w-1.5 h-1.5 bg-brand-500 rounded-full absolute top-1 right-2 animate-ping" />
                    )}
                  </button>
                </div>

                {/* TAB 1: metrics - Nutrition & Cardiovascular Health */}
                {resultTab === 'metrics' && (
                  <div className="space-y-5 animate-fade-in">
                    {/* CARDIOVASCULAR HEALTH GAUGE */}
                    {cardioTheme && (
                      <div className={`p-4 rounded-2xl border ${cardioTheme.colorClass} shadow-sm space-y-2.5`}>
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold uppercase tracking-wider">Tác động Tim mạch</span>
                          <div className="flex items-center gap-1">
                            {CardioIcon && <CardioIcon className="w-4 h-4" />}
                            <span className="text-sm font-black">{cardioTheme.title}</span>
                          </div>
                        </div>
                        
                        {/* Linear Gauge Bar */}
                        <div className="w-full h-3 bg-slate-200/70 rounded-full overflow-hidden relative">
                          <div
                            className={`h-full ${cardioTheme.gaugeColor} transition-all duration-1000 rounded-full shadow-inner`}
                            style={{ width: `${cardioTheme.percentage}%` }}
                          />
                        </div>
                        <p className="text-xs font-medium leading-relaxed opacity-90">{cardioTheme.desc}</p>
                      </div>
                    )}

                    {/* NUTRITIONAL GRID OF 6 PROGRESS CARDS */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Calo */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-orange-100 text-orange-600 flex items-center justify-center mb-1">
                          <Flame size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Calo</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.calo} <span className="text-[9px] font-normal text-slate-400">kcal</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-orange-500" style={{ width: `${Math.min((parsedMetrics.calo / 800) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Protein */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-1">
                          <Activity size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Protein</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.protein} <span className="text-[9px] font-normal text-slate-400">g</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-blue-500" style={{ width: `${Math.min((parsedMetrics.protein / 30) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Carbs */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center mb-1">
                          <Utensils size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Carbs</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.carbs} <span className="text-[9px] font-normal text-slate-400">g</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-purple-500" style={{ width: `${Math.min((parsedMetrics.carbs / 100) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Fat */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-red-100 text-red-600 flex items-center justify-center mb-1">
                          <ShieldAlert size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Chất béo</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.fat} <span className="text-[9px] font-normal text-slate-400">g</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-red-500" style={{ width: `${Math.min((parsedMetrics.fat / 25) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Sodium */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center mb-1">
                          <Info size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Muối</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.sodium} <span className="text-[9px] font-normal text-slate-400">mg</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-amber-500" style={{ width: `${Math.min((parsedMetrics.sodium / 800) * 100, 100)}%` }} />
                        </div>
                      </div>

                      {/* Fiber */}
                      <div className="bg-slate-50/80 p-2.5 rounded-xl border border-slate-100 hover:shadow-sm transition-all text-center">
                        <div className="mx-auto w-6 h-6 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center mb-1">
                          <TrendingUp size={14} />
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400">Chất xơ</p>
                        <p className="text-xs font-black text-slate-800">{parsedMetrics.fiber} <span className="text-[9px] font-normal text-slate-400">g</span></p>
                        <div className="w-full h-1 bg-slate-200 rounded-full mt-1.5 overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${Math.min((parsedMetrics.fiber / 10) * 100, 100)}%` }} />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: commentary - Doctor Commentary Box */}
                {resultTab === 'commentary' && (
                  <div className="space-y-2 animate-fade-in">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                      <BookOpen size={12} /> Nhận xét chi tiết của Bác sĩ AI
                    </h3>
                    <div className="bg-slate-50 rounded-2xl p-4 border border-slate-150 max-h-80 overflow-y-auto custom-scrollbar shadow-inner text-sm">
                      {renderMarkdown(result.text)}
                    </div>
                  </div>
                )}

                {/* TAB 3: recommendations - Actionable Checklist */}
                {resultTab === 'recommendations' && (
                  <div className="space-y-3 animate-fade-in">
                    <div className="flex justify-between items-center">
                      <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                        <Award size={12} /> Hành động khuyến nghị ({completedRecs}/{totalRecs})
                      </h3>
                      {completedRecs === totalRecs && totalRecs > 0 && (
                        <span className="text-[10px] font-extrabold text-emerald-600 animate-bounce flex items-center gap-0.5">
                          ⭐ Đã ghi nhận!
                        </span>
                      )}
                    </div>

                    {parsedMetrics.recommendations && parsedMetrics.recommendations.length > 0 ? (
                      <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                        {parsedMetrics.recommendations.map((rec, i) => (
                          <label
                            key={i}
                            className={`flex items-start gap-2.5 p-2.5 rounded-xl border transition-all cursor-pointer select-none ${
                              checkedRecs[i]
                                ? 'bg-slate-50 border-slate-200 text-slate-400 line-through'
                                : 'bg-white border-slate-150 hover:border-brand-200 text-slate-700 shadow-sm'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={!!checkedRecs[i]}
                              onChange={() => setCheckedRecs(prev => ({ ...prev, [i]: !prev[i] }))}
                              className="mt-0.5 rounded border-slate-300 text-brand-600 focus:ring-brand-500 w-4 h-4 shrink-0"
                            />
                            <span className="text-xs sm:text-sm font-medium leading-relaxed">{rec}</span>
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="text-center py-6 text-slate-400 text-xs">
                        Không có lời khuyên cụ thể nào cần tích chọn cho bữa ăn này.
                      </div>
                    )}
                  </div>
                )}

              </div>
              
              {/* Dynamic Health Encouragement */}
              <div className="bg-gradient-to-r from-emerald-500 to-brand-600 text-white rounded-2xl p-4 shadow-md flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                  <Heart className="w-6 h-6 animate-pulse text-white" />
                </div>
                <div>
                  <p className="text-sm font-bold">Chăm sóc tim mạch chủ động</p>
                  <p className="text-xs text-white/90 leading-relaxed mt-0.5">Ăn bớt mặn, hạn chế mỡ béo sẽ giảm đến 80% nguy cơ nhồi máu cơ tim & đột quỵ.</p>
                </div>
              </div>

            </div>
          )}

          {/* Initial state guide when there is no analysis result */}
          {!result && !loading && (
            <div className="section-card bg-white border border-slate-200 shadow-md p-6 text-center space-y-4">
              <div className="mx-auto w-12 h-12 rounded-2xl bg-brand-50 text-brand-600 flex items-center justify-center shadow-inner">
                <Utensils className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-slate-800">Sẵn sàng phân tích bữa ăn</h3>
                <p className="text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Hãy nhập thực đơn hoặc tải ảnh lên. Kết quả phân tích về mỡ, đạm, đường và tác động tim mạch sẽ hiển thị tại đây.
                </p>
              </div>
              
              {/* Quick display healthy tips in place of results */}
              <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 text-left space-y-2.5">
                <p className="text-xs font-bold text-slate-700 border-b border-slate-200 pb-1 flex items-center gap-1.5">
                  <Info size={12} className="text-brand-500" />
                  Mách bạn thói quen lành mạnh:
                </p>
                <ul className="space-y-1.5">
                  {TIPS.slice(0, 3).map((tip, i) => (
                    <li key={i} className="text-[11px] text-slate-500 flex items-start gap-1.5 leading-relaxed">
                      <span className="text-brand-500 font-bold shrink-0">•</span>
                      <span>{tip}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* HISTORY LOG DIARY */}
          <div className="section-card bg-white border border-slate-200 shadow-md p-5 sm:p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-slate-800 text-sm sm:text-base flex items-center gap-2">
                <Bookmark className="text-brand-500 w-5 h-5" />
                Nhật ký bữa ăn gần đây
              </h3>
              {history.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setHistory([])
                    localStorage.removeItem(HISTORY_KEY)
                  }}
                  className="text-xs text-red-500 font-bold hover:underline flex items-center gap-0.5 active:scale-95"
                >
                  <Trash2 size={12} /> Xóa hết
                </button>
              )}
            </div>

            {history.length === 0 ? (
              <div className="text-center py-8 text-slate-400 space-y-2">
                <p className="text-xs">Chưa ghi nhận thực đơn nào.</p>
                <p className="text-[10px] text-slate-300">Thông tin phân tích cũ sẽ hiển thị ở đây để tra cứu nhanh.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar pr-1">
                {history.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => handleReloadHistory(item)}
                    className="p-3 rounded-xl border border-slate-100 hover:border-brand-200 hover:bg-brand-50/10 transition-all cursor-pointer flex items-center gap-3 active:scale-99 hover:shadow-sm"
                  >
                    {item.imagePreview ? (
                      <img
                        src={item.imagePreview}
                        alt=""
                        className="w-12 h-12 object-cover rounded-lg border border-slate-200 shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-brand-50/60 text-brand-600 flex items-center justify-center shrink-0">
                        <Utensils size={18} />
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-slate-800 text-xs truncate">{item.food}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {new Date(item.timestamp).toLocaleDateString('vi-VN')} · {new Date(item.timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <ChevronRight size={14} className="text-slate-300 group-hover:text-brand-500 shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>

      </div>

      {/* HEALTH TIPS CARDS (Bottom row) */}
      <div className="section-card bg-gradient-to-br from-emerald-50/40 via-cyan-50/30 to-white border border-emerald-100/60 shadow-md">
        <h3 className="text-base sm:text-lg font-black text-slate-800 mb-4 flex items-center gap-2">
          <Award className="text-emerald-600" />
          Quy tắc Dinh dưỡng vàng phòng bệnh Tim mạch
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          {TIPS.map((tip, idx) => (
            <div key={idx} className="bg-white/80 backdrop-blur-sm p-4 rounded-xl border border-slate-100 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
              <span className="text-2xl font-bold text-emerald-600 mb-2">0{idx + 1}</span>
              <p className="text-xs text-slate-600 leading-relaxed font-semibold">{tip}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Full Screen Image Zoom Modal */}
      {showImageModal && mealImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4 animate-fade-in backdrop-blur-sm"
          onClick={() => setShowImageModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-2xl w-full overflow-hidden shadow-2xl animate-scale-in"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-between items-center px-6 py-4 border-b border-slate-150">
              <h2 className="font-black text-slate-800 text-sm sm:text-base truncate">{mealImage.name}</h2>
              <button
                onClick={() => setShowImageModal(false)}
                className="p-1.5 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-4 bg-slate-950 flex justify-center items-center">
              <img
                src={mealImage.dataUrl}
                alt="Bữa ăn xem lớn"
                className="max-h-[60vh] object-contain rounded-lg"
              />
            </div>
          </div>
        </div>
      )}

      {/* Hint Modal for Image Upload */}
      {showHintModal && mealImage && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
          onClick={() => setShowHintModal(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl animate-scale-in border border-slate-100"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-600 to-emerald-600 p-5 text-white flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h3 className="font-bold text-sm sm:text-base">Gợi ý cho Bác sĩ AI</h3>
                <p className="text-[10px] text-white/80">Giúp AI nhận diện chính xác món ăn của bạn</p>
              </div>
              <button
                onClick={() => setShowHintModal(false)}
                className="ml-auto p-1 hover:bg-white/10 rounded-full text-white transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4">
              {/* Image Preview in Modal */}
              <div className="rounded-xl overflow-hidden border border-slate-100 max-h-36 bg-slate-50 flex items-center justify-center relative">
                <img
                  src={mealImage.dataUrl}
                  alt="Ảnh bữa ăn"
                  className="max-h-36 object-contain"
                />
              </div>

              {/* Chat-like Prompt */}
              <div className="bg-brand-50/60 border border-brand-100 rounded-2xl p-4 flex gap-3">
                <div className="w-8 h-8 rounded-full bg-brand-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm mt-0.5">
                  AI
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-brand-800">Bác sĩ AI khuyên dùng:</p>
                  <p className="text-xs text-brand-900 leading-relaxed">
                    Bạn muốn tôi phân tích món ăn gì trong ảnh này? Hãy nhập tên món ăn hoặc gợi ý ngắn (ví dụ: <em>rau muống xào, salad gà, cơm tấm</em>...) để tôi nhận diện chuẩn xác nhất nhé!
                  </p>
                </div>
              </div>

              {/* Form Input */}
              <div className="space-y-2">
                <label htmlFor="hint-input" className="block text-xs font-bold text-slate-500 uppercase tracking-wider">
                  Mô tả/Gợi ý món ăn:
                </label>
                <input
                  id="hint-input"
                  type="text"
                  value={imageHint}
                  onChange={(e) => setImageHint(e.target.value)}
                  placeholder="Ví dụ: Đĩa rau luộc thập cẩm..."
                  className="w-full px-4 py-2.5 text-sm text-slate-800 bg-slate-50 border border-slate-205 rounded-xl focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all shadow-inner"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      setShowHintModal(false)
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-5 py-3.5 bg-slate-50/80 border-t border-slate-100 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => {
                  setImageHint('')
                  setShowHintModal(false)
                }}
                className="px-4 py-2 text-xs font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                Bỏ qua
              </button>
              <button
                type="button"
                onClick={() => setShowHintModal(false)}
                className="px-5 py-2 bg-gradient-to-r from-brand-600 to-emerald-600 hover:from-brand-700 hover:to-emerald-700 text-white text-xs font-bold rounded-xl transition-all shadow-sm active:scale-95 flex items-center gap-1.5"
              >
                Xác nhận
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
