import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle, Eye, Zap, Mic, Clock, Shield, RefreshCw, Video, Upload, Link2, ShieldAlert, Phone, Activity, CheckCircle2, Heart, Info, X, BookOpen, Bluetooth, Play, Square } from 'lucide-react'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import '@tensorflow/tfjs-backend-cpu'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import * as poseDetection from '@tensorflow-models/pose-detection'
import api from '../api/axios'
import { useSurveillance } from '../context/SurveillanceContext'

/*
  GHI CHÚ VẤN ĐÁP:
  Component này là phần xử lý chính của F.A.S.T Test.
  Input X:
  - Frame video từ webcam, video demo hoặc IP camera.
  - Âm thanh/giọng nói cho phần Speech.
  - BPM cho phần Heart Rate.
  Hàm xử lý f:
  - Face: FaceMesh/face landmarks + công thức tính bất đối xứng khuôn mặt.
  - Arms: MoveNet pose estimation + so sánh keypoint vai, khuỷu tay, cổ tay.
  - Speech: Speech Recognition hoặc backend phân tích video speech.
  - Time/SOS: rule-based trigger để kích hoạt cảnh báo khẩn cấp.
  - Heart Rate: threshold rule + backend /api/heart-rate-advice.
  Output y:
  - Cảnh báo Face/Arms/Speech/Heart Rate.
  - Snapshot gửi đến /api/emergency-alert để nhận hướng dẫn sơ cứu.
  Khi thầy hỏi y = f(X):
  - X là frame video/âm thanh/BPM; f là FaceMesh, MoveNet, Speech Recognition và rule xử lý;
    y là cảnh báo dấu hiệu đột quỵ hoặc cảnh báo nhịp tim.
*/

// Module-level global cache for TensorFlow.js models to prevent reload latency on page transitions
let cachedFaceDetector = null
let cachedPoseDetector = null
let cachedModelsLoaded = false
let modelsLoadingPromise = null

// ============================================================================
// SMART SURVEILLANCE & F.A.S.T TEST SYSTEM (FRONTEND)
// ============================================================================

export default function FASTTestComponent() {
  const { fastTestState, setFastTestState } = useSurveillance();
  const { sosTriggered, sosType, emergencyAdvice, detectionMetrics, speechStatus, speechResult: speechTranscript } = fastTestState;

  // Local state updater wrappers to avoid rewriting the whole component
  const setSOSTriggered = (val) => setFastTestState(prev => ({...prev, sosTriggered: typeof val === 'function' ? val(prev.sosTriggered) : val}));
  const setSOSType = (val) => setFastTestState(prev => ({...prev, sosType: typeof val === 'function' ? val(prev.sosType) : val}));
  const setEmergencyAdvice = (val) => setFastTestState(prev => ({...prev, emergencyAdvice: typeof val === 'function' ? val(prev.emergencyAdvice) : val}));
  const setDetectionMetrics = (val) => setFastTestState(prev => ({...prev, detectionMetrics: typeof val === 'function' ? val(prev.detectionMetrics) : val}));
  const setSpeechStatus = (val) => setFastTestState(prev => ({...prev, speechStatus: typeof val === 'function' ? val(prev.speechStatus) : val}));
  const setSpeechTranscript = (val) => setFastTestState(prev => ({...prev, speechResult: typeof val === 'function' ? val(prev.speechResult) : val}));

  // ========== STATE ==========
  const [activeTab, setActiveTab] = useState('F') // F (Face), A (Arms), S (Speech), T (Time/SOS)
  const [videoSource, setVideoSource] = useState('webcam') // 'webcam', 'upload', 'ipcamera'
  const [ipcameraUrl, setIpcameraUrl] = useState('')
  const [isRunning, setIsRunning] = useState(false)
  const [isLoadingModels, setIsLoadingModels] = useState(true)
  const [modelsError, setModelsError] = useState(null)
  
  // SOS State
  const [loadingAdvice, setLoadingAdvice] = useState(false)
  const [sosSnapshot, setSosSnapshot] = useState('')
  const [showGuideModal, setShowGuideModal] = useState(true)

  // ========== REFS ==========
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const inferenceCanvasRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const faceDetectorRef = useRef(null)
  const poseDetectorRef = useRef(null)
  const modelsLoadedRef = useRef(false) // Ensures models are initialized only ONCE

  // Algorithm state tracking refs
  const armDriftStartTimeRef = useRef(null)
  const prevShoulderYRef = useRef(null)
  const prevShoulderTimeRef = useRef(null)
  const speechTimeoutRef = useRef(null)
  const speechRecognitionRef = useRef(null)
  const sosReadyRef = useRef(false) // Prevents multiple triggers
  const fallAnomalyStartTimeRef = useRef(null)

  // Debounce counters
  const faceAccumulatedTimeRef = useRef(0) // Đếm thời gian liên tiếp có face asymmetry > ngưỡng
  const faceLastTimeRef = useRef(performance.now())
  const fallAnomalyCountRef = useRef(0)  // Đếm khung hình liên tiếp có shoulder ≈ ankle

  // Throttling and Caching refs
  const lastPoseTimeRef = useRef(0)
  const lastFaceTimeRef = useRef(0)
  const lastPosePointsRef = useRef(null)
  const lastFacePointsRef = useRef(null)
  const lastArmAsymmetryRef = useRef(0)
  const lastFaceAsymmetryRef = useRef(0)
  const lastFaceDetectedRef = useRef(false)

  // Ngưỡng debounce — đã hiệu chỉnh dựa trên dữ liệu video y khoa thực tế
  const FACE_ALERT_DURATION = 3000     // Giảm xuống 3 giây (3000ms) để phản hồi nhanh trong bài test tương tác
  const FALL_DEBOUNCE_THRESHOLD = 12   // >12 frame liên tiếp @ ~30fps
  const FACE_TRIGGER_RATIO = 5         // Tỷ lệ bất đối xứng > 5% thì count++ (y khoa: >5% là có dấu hiệu)
  const FACE_RESET_RATIO = 3           // Tỷ lệ < 3% thì reset count = 0
  const ARM_DRIFT_THRESHOLD = 60       // Chênh lệch Y cổ tay > 60px thì bắt đầu đếm thời gian
  const ARM_DRIFT_DURATION = 1500      // Giữ tay lệch > 1.5 giây thì trigger SOS
  const SPEECH_CONFIDENCE_THRESHOLD = 0.85 // Tăng độ nhạy (Web Speech API thường trả về >0.85 nếu nói rõ)

  const CLINICAL_FACE_ALERT_DURATION = 1800
  const CLINICAL_FACE_TRIGGER_RATIO = 5
  const CLINICAL_FACE_RESET_RATIO = 3
  const CLINICAL_ARM_DRIFT_THRESHOLD = 55
  const CLINICAL_ARM_DRIFT_DURATION = 1800
  const AI_INPUT_WIDTH = 480
  const AI_INPUT_HEIGHT = 360
  const FACE_INTERVAL_MS = 140
  const POSE_INTERVAL_MS = 160

  // Siren refs for repeating sound
  const sirenIntervalRef = useRef(null)
  const audioCtxRef = useRef(null)

  // ========== HEART RATE STATE (Tab H) ==========
  const [hrChartData, setHrChartData] = useState([])
  const [currentBpm, setCurrentBpm] = useState(null)
  const [isSimulating, setIsSimulating] = useState(false)
  const [isBluetoothConnected, setIsBluetoothConnected] = useState(false)
  const [bpmAlert, setBpmAlert] = useState(false)
  const [hrAdvice, setHrAdvice] = useState(null)      // { advice, severity }
  const [hrAdviceLoading, setHrAdviceLoading] = useState(false)
  const hrIntervalRef = useRef(null)
  const hrSimCounterRef = useRef(0)
  const hrBtCharRef = useRef(null)
  const hrBtDeviceRef = useRef(null)
  const hrAdviceTriggeredRef = useRef(false)           // gọi Gemini 1 lần duy nhất
  const MAX_HR_POINTS = 25

  // ========== LOAD MODELS (TENSORFLOW.JS) ==========
  // ========== HEART RATE FUNCTIONS ==========
  const pushBpmPoint = useCallback((bpm) => {
    const ts = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    setHrChartData(prev => {
      const next = [...prev, { time: ts, bpm }]
      return next.length > MAX_HR_POINTS ? next.slice(next.length - MAX_HR_POINTS) : next
    })
    setCurrentBpm(bpm)
    setBpmAlert(bpm > 100)
  }, [])

  const startSimulation = useCallback(() => {
    if (hrIntervalRef.current) return
    hrSimCounterRef.current = 0
    setIsSimulating(true)
    setBpmAlert(false)
    setHrChartData([])
    hrIntervalRef.current = setInterval(() => {
      hrSimCounterRef.current += 1
      let bpm
      if (hrSimCounterRef.current <= 10) {
        // Normal sinus rhythm 70-85 BPM
        bpm = Math.round(70 + Math.random() * 15)
      } else {
        // Tachycardia simulation 115-128 BPM
        bpm = Math.round(115 + Math.random() * 13)
      }
      pushBpmPoint(bpm)
    }, 1000)
  }, [pushBpmPoint])

  const stopHeartRate = useCallback(() => {
    if (hrIntervalRef.current) {
      clearInterval(hrIntervalRef.current)
      hrIntervalRef.current = null
    }
    if (hrBtCharRef.current) {
      try { hrBtCharRef.current.removeEventListener('characteristicvaluechanged', () => {}) } catch (_) {}
    }
    if (hrBtDeviceRef.current) {
      try { hrBtDeviceRef.current.gatt.disconnect() } catch (_) {}
      hrBtDeviceRef.current = null
    }
    setIsSimulating(false)
    setIsBluetoothConnected(false)
    setCurrentBpm(null)
    setBpmAlert(false)
    setHrChartData([])
    setHrAdvice(null)
    setHrAdviceLoading(false)
    hrAdviceTriggeredRef.current = false
    hrSimCounterRef.current = 0
  }, [])

  const connectBluetooth = useCallback(async () => {
    if (!navigator.bluetooth) {
      alert('Trình duyệt không hỗ trợ Web Bluetooth API. Hãy dùng Chrome/Edge trên desktop.')
      return
    }
    try {
      const device = await navigator.bluetooth.requestDevice({
        filters: [{ services: ['heart_rate'] }]
      })
      hrBtDeviceRef.current = device
      const server = await device.gatt.connect()
      const service = await server.getPrimaryService('heart_rate')
      const char = await service.getCharacteristic('heart_rate_measurement')
      hrBtCharRef.current = char
      char.addEventListener('characteristicvaluechanged', (e) => {
        const value = e.target.value
        const flags = value.getUint8(0)
        const is16bit = flags & 0x1
        const bpm = is16bit ? value.getUint16(1, true) : value.getUint8(1)
        pushBpmPoint(bpm)
      })
      await char.startNotifications()
      setIsBluetoothConnected(true)
      setIsSimulating(false)
    } catch (err) {
      console.error('[BT] Kết nối thất bại:', err)
      alert(`Kết nối Bluetooth thất bại: ${err.message}`)
    }
  }, [pushBpmPoint])

  // Cleanup heart rate on unmount
  useEffect(() => {
    return () => {
      if (hrIntervalRef.current) clearInterval(hrIntervalRef.current)
      if (hrBtDeviceRef.current) { try { hrBtDeviceRef.current.gatt.disconnect() } catch (_) {} }
    }
  }, [])

  // Theo dõi BPM — gọi Gemini 1 lần khi vượt ngưỡng 120 BPM
  useEffect(() => {
    if (currentBpm === null || currentBpm < 120) return
    if (hrAdviceTriggeredRef.current) return   // đã gọi rồi, không gọi lại
    hrAdviceTriggeredRef.current = true
    setHrAdviceLoading(true)
    api.post('/api/heart-rate-advice', {
      bpm: currentBpm,
      duration_seconds: hrSimCounterRef.current || null
    })
      .then(res => {
        setHrAdvice({ advice: res.data.advice, severity: res.data.severity })
      })
      .catch(() => {
        setHrAdvice({ advice: 'Gọi ngay 115. Để bệnh nhân nghỉ ngơi. Theo dõi ý thức liên tục.', severity: 'không xác định' })
      })
      .finally(() => setHrAdviceLoading(false))
  }, [currentBpm])

  // ========== LOAD MODELS (TENSORFLOW.JS) ==========
  useEffect(() => {
    let active = true

    const loadModels = async () => {
      // 1. Check if models are already loaded in cache
      if (cachedModelsLoaded && cachedFaceDetector && cachedPoseDetector) {
        console.log('[FAST] Using cached TensorFlow.js models.')
        faceDetectorRef.current = cachedFaceDetector
        poseDetectorRef.current = cachedPoseDetector
        modelsLoadedRef.current = true
        setIsLoadingModels(false)
        return
      }

      // 2. Check if models are already loading (wait for the existing promise)
      if (modelsLoadingPromise) {
        console.log('[FAST] Waiting for existing model loading promise...')
        try {
          setIsLoadingModels(true)
          setModelsError(null)
          await modelsLoadingPromise
          if (active) {
            faceDetectorRef.current = cachedFaceDetector
            poseDetectorRef.current = cachedPoseDetector
            modelsLoadedRef.current = true
            setIsLoadingModels(false)
          }
        } catch (err) {
          if (active) {
            setModelsError('Không thể tải mô hình AI. Vui lòng kiểm tra kết nối mạng của bạn.')
            setIsLoadingModels(false)
          }
        }
        return
      }

      // 3. Define load and warmup procedure
      const loadAndWarmup = async () => {
        console.log('[FAST] Initializing TensorFlow.js backend...')
        await tf.ready()

        console.log('[FAST] Loading MediaPipe FaceMesh model...')
        const faceModel = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
        const faceDetectorConfig = {
          runtime: 'tfjs',
          refineLandmarks: true
        }
        const faceDetector = await faceLandmarksDetection.createDetector(faceModel, faceDetectorConfig)

        console.log('[FAST] Loading MoveNet Pose Detection model...')
        const poseModel = poseDetection.SupportedModels.MoveNet
        const poseDetectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
        const poseDetector = await poseDetection.createDetector(poseModel, poseDetectorConfig)

        // --- AI WARMUP (Chống Lag/Đứng Máy ở frame đầu tiên) ---
        console.log('[FAST] Warming up AI models to compile WebGL shaders...');
        try {
          const warmupCanvas = document.createElement('canvas');
          warmupCanvas.width = AI_INPUT_WIDTH;
          warmupCanvas.height = AI_INPUT_HEIGHT;
          const warmupCtx = warmupCanvas.getContext('2d');
          if (warmupCtx) {
            warmupCtx.fillStyle = 'black';
            warmupCtx.fillRect(0, 0, AI_INPUT_WIDTH, AI_INPUT_HEIGHT);
            await faceDetector.estimateFaces(warmupCanvas);
            await poseDetector.estimatePoses(warmupCanvas);
            console.log('[FAST] Warmup complete.');
          }
        } catch(e) {
           console.warn('[FAST] Warmup failed:', e);
        }

        // Save to cache
        cachedFaceDetector = faceDetector
        cachedPoseDetector = poseDetector
        cachedModelsLoaded = true
      }

      // 4. Start load process and cache promise
      try {
        setIsLoadingModels(true)
        setModelsError(null)

        modelsLoadingPromise = loadAndWarmup()
        await modelsLoadingPromise
        modelsLoadingPromise = null

        if (active) {
          faceDetectorRef.current = cachedFaceDetector
          poseDetectorRef.current = cachedPoseDetector
          modelsLoadedRef.current = true
          setIsLoadingModels(false)
          console.log('[FAST] All models loaded and cached successfully!')
        }
      } catch (err) {
        console.error('[FAST] Error loading TensorFlow.js models:', err)
        modelsLoadingPromise = null
        if (active) {
          setModelsError('Không thể tải mô hình AI. Vui lòng kiểm tra kết nối mạng của bạn.')
          setIsLoadingModels(false)
        }
      }
    }

    loadModels()

    return () => {
      active = false
    }
  }, [])

  // ========== SIREN SOUND CONTROLS ==========
  const startSiren = useCallback(() => {
    try {
      if (audioCtxRef.current) return // Already running

      const AudioContextClass = window.AudioContext || window.webkitAudioContext
      if (!AudioContextClass) return

      const ctx = new AudioContextClass()
      audioCtxRef.current = ctx

      const playTone = () => {
        if (ctx.state === 'suspended') {
          ctx.resume().catch(() => {})
        }
        
        const osc = ctx.createOscillator()
        const gainNode = ctx.createGain()
        
        osc.connect(gainNode)
        gainNode.connect(ctx.destination)
        
        osc.type = 'sawtooth' // High visibility sound
        osc.frequency.setValueAtTime(500, ctx.currentTime)
        osc.frequency.linearRampToValueAtTime(900, ctx.currentTime + 0.4)
        osc.frequency.linearRampToValueAtTime(500, ctx.currentTime + 0.8)
        
        gainNode.gain.setValueAtTime(0.12, ctx.currentTime)
        gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8)
        
        osc.start(ctx.currentTime)
        osc.stop(ctx.currentTime + 0.8)
      }

      playTone()
      sirenIntervalRef.current = setInterval(playTone, 800)
    } catch (err) {
      console.warn('[FAST] Siren AudioContext initialization failed:', err)
    }
  }, [])

  const stopSiren = useCallback(() => {
    if (sirenIntervalRef.current) {
      clearInterval(sirenIntervalRef.current)
      sirenIntervalRef.current = null
    }
    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
  }, [])

  // ========== GEMINI AI EMERGENCY ADVICE ==========
  const fetchEmergencyAdvice = async (base64Image, alertType) => {
    try {
      setLoadingAdvice(true)
      const response = await api.post('/api/emergency-alert', {
        image_base64: base64Image,
        alert_type: alertType,
      })

      if (response.data?.emergency_advice) {
        setEmergencyAdvice(response.data.emergency_advice)
      } else if (response.data?.advice) {
        setEmergencyAdvice(response.data.advice)
      } else {
        setEmergencyAdvice('Không nhận được lời khuyên từ Bác sĩ AI. Vui lòng gọi ngay 115!')
      }
    } catch (err) {
      console.error('[FAST] Error fetching emergency advice:', err)
      setEmergencyAdvice('Lỗi kết nối bác sĩ AI. Hãy lập tức giữ thông thoáng đường thở và gọi 115!')
    } finally {
      setLoadingAdvice(false)
    }
  }

  // ========== TRIGGER SOS FLOW ==========
  const triggerSOS = useCallback((sosTypeTriggered) => {
    if (sosReadyRef.current) return // Avoid multiple triggers
    sosReadyRef.current = true

    console.warn(`[FAST] SOS TRIGGERED: ${sosTypeTriggered}`)

    // 1. Dừng ngay vòng lặp requestAnimationFrame
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }

    // 2. Chụp ảnh từ Canvas
    const canvas = canvasRef.current
    const video = videoRef.current
    let base64Image = ''
    if (canvas && video && video.videoWidth > 0 && video.videoHeight > 0) {
      const snapshotCanvas = document.createElement('canvas')
      snapshotCanvas.width = canvas.width
      snapshotCanvas.height = canvas.height
      const snapshotCtx = snapshotCanvas.getContext('2d')
      if (snapshotCtx) {
        snapshotCtx.drawImage(video, 0, 0, snapshotCanvas.width, snapshotCanvas.height)
        snapshotCtx.drawImage(canvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height)
        base64Image = snapshotCanvas.toDataURL('image/jpeg', 0.85)
      }
    } else if (canvas) {
      base64Image = canvas.toDataURL('image/jpeg', 0.85)
    }
    if (base64Image) {
      setSosSnapshot(base64Image)
    }

    // 3. Auto-switch sang Tab T, đổi viền UI và hú còi
    setActiveTab('T')
    setSOSTriggered(true)
    setSOSType(sosTypeTriggered)
    setIsRunning(false)

    startSiren()

    // 4. Gọi Cloud AI lấy lời khuyên sơ cứu
    fetchEmergencyAdvice(base64Image, sosTypeTriggered)
  }, [startSiren])

  // ========== LANDMARKS HELPERS ==========
  const getKeypoint = (face, index) => {
    if (!face) return null
    // Case 1: face.keypoints
    if (face.keypoints && face.keypoints[index]) {
      const kp = face.keypoints[index]
      return { x: kp.x, y: kp.y }
    }
    // Case 2: face.landmarks
    if (face.landmarks && face.landmarks[index]) {
      const lm = face.landmarks[index]
      return { x: lm[0], y: lm[1] }
    }
    // Case 3: face is a direct array
    if (Array.isArray(face) && face[index]) {
      const pt = face[index]
      return Array.isArray(pt) ? { x: pt[0], y: pt[1] } : { x: pt.x, y: pt.y }
    }
    return null
  }

  const getAsymmetryRatio = (face) => {
    // Nose tip: 4 (or 1 as fallback), Left mouth corner: 78, Right mouth corner: 308
    const noseTip = getKeypoint(face, 4) || getKeypoint(face, 1)
    const leftMouth = getKeypoint(face, 78) || getKeypoint(face, 61)
    const rightMouth = getKeypoint(face, 308) || getKeypoint(face, 291)

    if (!noseTip || !leftMouth || !rightMouth) return 0

    // --- Metric 1: Khoảng cách từ mũi đến 2 khóe miệng (distance ratio) ---
    const distLeft = Math.hypot(noseTip.x - leftMouth.x, noseTip.y - leftMouth.y)
    const distRight = Math.hypot(noseTip.x - rightMouth.x, noseTip.y - rightMouth.y)

    let distanceRatio = 0
    if (distLeft > 0 || distRight > 0) {
      const maxDist = Math.max(distLeft, distRight)
      distanceRatio = (Math.abs(distLeft - distRight) / maxDist) * 100
    }

    // --- Metric 2: Chênh lệch Y khóe miệng (mouth droop / rũ miệng trực tiếp) ---
    // Chuẩn hóa bằng chiều rộng miệng để không phụ thuộc khoảng cách camera
    const mouthWidth = Math.hypot(leftMouth.x - rightMouth.x, leftMouth.y - rightMouth.y)
    let droopRatio = 0
    if (mouthWidth > 5) { // tránh chia cho 0
      const mouthYDiff = Math.abs(leftMouth.y - rightMouth.y)
      droopRatio = (mouthYDiff / mouthWidth) * 100
    }

    // --- Metric 3: Lệch góc miệng so với đường ngang ---
    // Góc giữa 2 khóe miệng so với trục ngang; mặt bình thường góc ≈ 0°
    let angleRatio = 0
    const dx = rightMouth.x - leftMouth.x
    const dy = rightMouth.y - leftMouth.y
    if (Math.abs(dx) > 5) {
      const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI))
      angleRatio = angleDeg * 2 // nhân 2 để chuyển từ độ sang % (5° ≈ 10%)
    }

    // Lấy giá trị lớn nhất giữa 3 metrics để tăng độ nhạy
    const combined = Math.max(distanceRatio, droopRatio, angleRatio)
    return combined
  }

  const getClinicalFaceAsymmetryRatio = (face) => {
    const noseTip = getKeypoint(face, 4) || getKeypoint(face, 1)
    const leftMouth = getKeypoint(face, 61) || getKeypoint(face, 78)
    const rightMouth = getKeypoint(face, 291) || getKeypoint(face, 308)
    const leftEye = getKeypoint(face, 33) || getKeypoint(face, 133)
    const rightEye = getKeypoint(face, 263) || getKeypoint(face, 362)

    if (!noseTip || !leftMouth || !rightMouth) return 0

    const rotateAround = (point, origin, angle) => {
      const cos = Math.cos(angle)
      const sin = Math.sin(angle)
      const dx = point.x - origin.x
      const dy = point.y - origin.y
      return {
        x: origin.x + dx * cos - dy * sin,
        y: origin.y + dx * sin + dy * cos,
      }
    }

    let rollAngle = 0
    if (leftEye && rightEye && Math.abs(rightEye.x - leftEye.x) > 4) {
      rollAngle = Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x)
    }

    const faceCenter = leftEye && rightEye
      ? { x: (leftEye.x + rightEye.x) / 2, y: (leftEye.y + rightEye.y) / 2 }
      : noseTip
    const correctedNose = rotateAround(noseTip, faceCenter, -rollAngle)
    const correctedLeftMouth = rotateAround(leftMouth, faceCenter, -rollAngle)
    const correctedRightMouth = rotateAround(rightMouth, faceCenter, -rollAngle)

    const distLeft = Math.hypot(correctedNose.x - correctedLeftMouth.x, correctedNose.y - correctedLeftMouth.y)
    const distRight = Math.hypot(correctedNose.x - correctedRightMouth.x, correctedNose.y - correctedRightMouth.y)
    const maxDist = Math.max(distLeft, distRight)
    const distanceRatio = maxDist > 0 ? (Math.abs(distLeft - distRight) / maxDist) * 100 : 0

    const mouthWidth = Math.hypot(
      correctedLeftMouth.x - correctedRightMouth.x,
      correctedLeftMouth.y - correctedRightMouth.y
    )
    const droopRatio = mouthWidth > 5
      ? (Math.abs(correctedLeftMouth.y - correctedRightMouth.y) / mouthWidth) * 100
      : 0

    const legacyRatio = getAsymmetryRatio(face)
    return Math.max(distanceRatio, droopRatio, legacyRatio)
  }

  // ========== SPEECH RECOGNITION (TAB S) ==========
  const startSpeechTest = useCallback(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      alert('Trình duyệt không hỗ trợ Speech Recognition. Vui lòng dùng Google Chrome.')
      setSpeechStatus('error')
      return
    }

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.abort()
      } catch (e) {}
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'vi-VN'

    setSpeechStatus('listening')
    setSpeechTranscript('')

    // ── Timeout 15s: Tăng thời gian chờ để API kịp nghe và trả kết quả ──
    if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
    speechTimeoutRef.current = setTimeout(() => {
      console.log('[FAST] Speech recognition timeout (15s) – yêu cầu thử lại, không trigger SOS.')
      recognition.abort()
      setSpeechStatus('retry') // Trạng thái mới: yêu cầu thử lại
    }, 15000)

    recognition.onresult = (event) => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      const result = event.results[0]?.[0]
      const transcript = result?.transcript || ''
      const confidence = result?.confidence ?? 1.0
      setSpeechTranscript(transcript)
      console.log(`[FAST] Speech Recognized: "${transcript}" (confidence: ${confidence.toFixed(2)})`)

      // ── CHỈ trigger SOS khi bắt được text nhưng confidence thấp hoặc không đúng từ khóa ──
      const textLower = transcript.toLowerCase();
      const hasKeywords = textLower.includes('khỏe') || textLower.includes('bình thường') || textLower.includes('bầu trời') || textLower.includes('xanh');

      if (transcript.trim().length > 0) {
        if (confidence < SPEECH_CONFIDENCE_THRESHOLD || !hasKeywords) {
          console.warn(`[FAST] Abnormal speech detected (${confidence.toFixed(2)}) → SOS`)
          setSpeechStatus('error')
          triggerSOS('Speech Disorder')
        } else {
          setSpeechStatus('success')
        }
      } else {
        // Không nhận được từ nào – chỉ báo lỗi nhẹ, không trigger SOS
        setSpeechStatus('retry')
      }
    }

    // ── onerror: KHÔNG trigger SOS, chỉ hiện thông báo thử lại ──
    recognition.onerror = (event) => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      // Bỏ qua lỗi 'aborted' (do chúng ta tự abort khi timeout)
      if (event.error === 'aborted') return
      console.warn('[FAST] Speech recognition error (non-fatal):', event.error)
      setSpeechStatus('retry')
    }

    recognition.onend = () => {
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
    }

    try {
      recognition.start()
      speechRecognitionRef.current = recognition
    } catch (e) {
      console.error('[FAST] Speech start failed:', e)
      setSpeechStatus('retry')
    }
  }, [triggerSOS, SPEECH_CONFIDENCE_THRESHOLD])

  useEffect(() => {
    if (activeTab === 'S' && isRunning) {
      startSpeechTest()
    } else {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort()
        } catch (e) {}
      }
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      setSpeechStatus('idle')
    }

    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.abort()
        } catch (e) {}
      }
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
    }
  }, [activeTab, isRunning, startSpeechTest])

  // ========== DETECTION LOOP ==========
  const runDetectionLoop = useCallback(async () => {
    if (!isRunning) return

    const video = videoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0 || video.videoHeight === 0) {
        rafRef.current = requestAnimationFrame(runDetectionLoop);
        return;
    }

    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')

    if (!canvas || !ctx) {
      rafRef.current = requestAnimationFrame(runDetectionLoop)
      return
    }

    if (!inferenceCanvasRef.current) {
      inferenceCanvasRef.current = document.createElement('canvas')
    }
    const inferenceCanvas = inferenceCanvasRef.current
    inferenceCanvas.width = AI_INPUT_WIDTH
    inferenceCanvas.height = AI_INPUT_HEIGHT
    const inferenceCtx = inferenceCanvas.getContext('2d', { willReadFrequently: false })
    if (!inferenceCtx) {
      rafRef.current = requestAnimationFrame(runDetectionLoop)
      return
    }

    try {
      const scaleX = canvas.width / AI_INPUT_WIDTH
      const scaleY = canvas.height / AI_INPUT_HEIGHT
      const nowTime = performance.now()

      inferenceCtx.drawImage(video, 0, 0, AI_INPUT_WIDTH, AI_INPUT_HEIGHT)
      ctx.setTransform(1, 0, 0, 1, 0, 0)
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      // 1. ===== Pose Detection =====
      if (poseDetectorRef.current) {
        // Run Pose Detection every frame if activeTab === 'A' (Arms test),
        // or once every 300ms if in other tabs (for background fall detection).
        const shouldRunPose = activeTab === 'A' && (nowTime - lastPoseTimeRef.current > POSE_INTERVAL_MS)

        if (shouldRunPose) {
          const poses = await poseDetectorRef.current.estimatePoses(inferenceCanvas)
          lastPoseTimeRef.current = nowTime

          if (poses && poses.length > 0) {
            const pose = poses[0]
            const keypoints = pose.keypoints

            // Map and scale pose points to canvas space
            const getCanvasPoint = (kp) => {
              const sx = kp.x * scaleX
              const sy = kp.y * scaleY
              return { x: sx, y: sy, score: kp.score, name: kp.name }
            }

            lastPosePointsRef.current = keypoints.map(getCanvasPoint)

            // --- Tab A (Liệt tay) Algorithm (Chỉ chạy khi ở Tab A) ---
            if (activeTab === 'A') {
              const pts = lastPosePointsRef.current
              const getPosePoint = (name, index) => pts.find((kp) => kp.name === name) || pts[index]
              const leftShoulder = getPosePoint('left_shoulder', 5)
              const rightShoulder = getPosePoint('right_shoulder', 6)
              const leftElbow = getPosePoint('left_elbow', 7)
              const rightElbow = getPosePoint('right_elbow', 8)
              const leftWrist = getPosePoint('left_wrist', 9)
              const rightWrist = getPosePoint('right_wrist', 10)

              const leftArmVisible = leftShoulder?.score > 0.25 && leftElbow?.score > 0.25 && leftWrist?.score > 0.25
              const rightArmVisible = rightShoulder?.score > 0.25 && rightElbow?.score > 0.25 && rightWrist?.score > 0.25

              if (leftArmVisible && rightArmVisible) {
                const armAsymmetry = Math.abs(leftWrist.y - rightWrist.y)
                
                // EMA smoothing for Arm Asymmetry
                const prevArm = lastArmAsymmetryRef.current
                const smoothedArm = prevArm === 0 ? armAsymmetry : (0.15 * armAsymmetry + 0.85 * prevArm)
                lastArmAsymmetryRef.current = smoothedArm

                setDetectionMetrics((prev) => ({ ...prev, armAsymmetry: smoothedArm }))

                if (smoothedArm > CLINICAL_ARM_DRIFT_THRESHOLD) {
                  if (!armDriftStartTimeRef.current) {
                    armDriftStartTimeRef.current = performance.now()
                  } else if (performance.now() - armDriftStartTimeRef.current > CLINICAL_ARM_DRIFT_DURATION) {
                    triggerSOS('Arms Paralysis')
                  }
                } else {
                  armDriftStartTimeRef.current = null
                }
              } else {
                lastArmAsymmetryRef.current = 0
                setDetectionMetrics((prev) => ({ ...prev, armAsymmetry: 0 }))
                armDriftStartTimeRef.current = null
              }
            }

            // --- Background Task (Fall Detection) Algorithm với Debounce (Chỉ chạy khi không ở Tab A) ---
            if (activeTab !== 'A') {
              const pts = lastPosePointsRef.current
              const leftShoulder = pts.find((kp) => kp.name === 'left_shoulder')
              const rightShoulder = pts.find((kp) => kp.name === 'right_shoulder')
              const leftAnkle = pts.find((kp) => kp.name === 'left_ankle')
              const rightAnkle = pts.find((kp) => kp.name === 'right_ankle')

              if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
                const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2

                if (prevShoulderYRef.current !== null && prevShoulderTimeRef.current !== null) {
                  const deltaY = avgShoulderY - prevShoulderYRef.current
                  const deltaTime = nowTime - prevShoulderTimeRef.current

                  if (deltaTime > 0) {
                    const speed = deltaY / deltaTime
                    setDetectionMetrics((prev) => ({ ...prev, fallVelocity: speed * 100 }))
                  }
                }
                prevShoulderYRef.current = avgShoulderY
                prevShoulderTimeRef.current = nowTime

                // Time-based Fall Debounce
                if (leftAnkle && rightAnkle && leftAnkle.score > 0.3 && rightAnkle.score > 0.3) {
                  const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2
                  const shoulderAnkleDiff = Math.abs(avgShoulderY - avgAnkleY)

                  if (shoulderAnkleDiff < 150) {
                    if (!fallAnomalyStartTimeRef.current) {
                      fallAnomalyStartTimeRef.current = nowTime
                    } else if (nowTime - fallAnomalyStartTimeRef.current > 1500) {
                      triggerSOS('Fall Detection')
                    }
                  } else {
                    fallAnomalyStartTimeRef.current = null
                  }
                } else {
                  fallAnomalyStartTimeRef.current = null
                }
              } else {
                fallAnomalyStartTimeRef.current = null
              }
            }

          } else {
            lastPosePointsRef.current = null
            lastArmAsymmetryRef.current = 0
            setDetectionMetrics((prev) => ({ ...prev, armAsymmetry: 0 }))
            armDriftStartTimeRef.current = null
            fallAnomalyStartTimeRef.current = null
          }
        }
      }

      // --- Draw Pose Skeleton from Cache on Every Frame ---
      if (lastPosePointsRef.current) {
        const pts = lastPosePointsRef.current
        if (activeTab === 'A') {
          // Draw skeleton lines for arms
          const findPt = (name, index) => {
            const point = pts.find(p => p.name === name) || pts[index]
            return point?.score > 0.25 ? point : null
          }
          const drawLine = (ptA, ptB) => {
            if (ptA && ptB) {
              ctx.strokeStyle = '#06b6d4'
              ctx.lineWidth = 4
              ctx.beginPath()
              ctx.moveTo(ptA.x, ptA.y)
              ctx.lineTo(ptB.x, ptB.y)
              ctx.stroke()
            }
          }
          const lSh = findPt('left_shoulder', 5)
          const rSh = findPt('right_shoulder', 6)
          const lEl = findPt('left_elbow', 7)
          const rEl = findPt('right_elbow', 8)
          const lWr = findPt('left_wrist', 9)
          const rWr = findPt('right_wrist', 10)

          drawLine(lSh, lEl)
          drawLine(lEl, lWr)
          drawLine(rSh, rEl)
          drawLine(rEl, rWr)

          // Draw glowing joint points
          pts.forEach((kp) => {
            if (kp.score > 0.3 && ['left_shoulder', 'right_shoulder', 'left_elbow', 'right_elbow', 'left_wrist', 'right_wrist'].includes(kp.name)) {
              ctx.fillStyle = '#22d3ee'
              ctx.shadowColor = '#06b6d4'
              ctx.shadowBlur = 8
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI)
              ctx.fill()
              ctx.shadowBlur = 0 // reset
            }
          })
        } else {
          // In other tabs, show subtle pose points for background fall detection
          ctx.fillStyle = 'rgba(239, 68, 68, 0.25)'
          pts.forEach((kp) => {
            if (kp.score > 0.3) {
              ctx.beginPath()
              ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI)
              ctx.fill()
            }
          })
        }
      }

      // 2. ===== Face Landmark Detection =====
      const dt = Math.min(faceLastTimeRef.current ? nowTime - faceLastTimeRef.current : 16, 100)
      faceLastTimeRef.current = nowTime

      let faceDetected = lastFaceDetectedRef.current
      let asymmetry = lastFaceAsymmetryRef.current

      if (activeTab === 'F' && faceDetectorRef.current) {
        const shouldRunFace = nowTime - lastFaceTimeRef.current > FACE_INTERVAL_MS

        if (shouldRunFace) {
          const faceLandmarks = await faceDetectorRef.current.estimateFaces(inferenceCanvas)
          lastFaceTimeRef.current = nowTime

          if (faceLandmarks && faceLandmarks.length > 0) {
            faceDetected = true
            const face = faceLandmarks[0]
            const rawAsymmetry = getClinicalFaceAsymmetryRatio(face)
            
            // EMA smoothing
            const prevAsymmetry = lastFaceAsymmetryRef.current
            asymmetry = prevAsymmetry === 0 ? rawAsymmetry : (0.35 * rawAsymmetry + 0.65 * prevAsymmetry)
            
            lastFaceAsymmetryRef.current = asymmetry
            lastFaceDetectedRef.current = true

            setDetectionMetrics((prev) => ({ ...prev, faceAsymmetry: asymmetry, faceDetected: true }))

            // Cache scaled canvas points
            const facePoints = face.keypoints || face.landmarks
            if (facePoints) {
              const clinicalFacePoints = []
              ;[1, 4, 61, 78, 291, 308].forEach((index) => {
                const lm = facePoints[index]
                if (!lm) return
                const lx = (typeof lm.x === 'number' ? lm.x : lm[0]) * scaleX
                const ly = (typeof lm.y === 'number' ? lm.y : lm[1]) * scaleY
                clinicalFacePoints[index] = { x: lx, y: ly }
              })
              lastFacePointsRef.current = clinicalFacePoints
            }
          } else {
            faceDetected = false
            asymmetry = 0
            lastFaceAsymmetryRef.current = 0
            lastFaceDetectedRef.current = false
            lastFacePointsRef.current = null
            setDetectionMetrics((prev) => ({ ...prev, faceAsymmetry: 0, faceDetected: false }))
          }
        }
      }

      // --- Draw Face Landmarks from Cache on Every Frame ---
      if (activeTab === 'F' && lastFacePointsRef.current) {
        const pts = lastFacePointsRef.current
        ctx.fillStyle = 'rgba(34, 197, 94, 0.85)' // Tăng độ mờ lên 85% để nhìn rõ trên ảnh chụp/video
        pts.forEach((pt) => {
          ctx.beginPath()
          ctx.arc(pt.x, pt.y, 2, 0, 2 * Math.PI) // Tăng kích thước điểm lưới lên 2px
          ctx.fill()
        })

        // Vẽ các mốc cơ mặt quan trọng (noseTip, leftMouth, rightMouth) kèm đường nối đo lường
        const activeNose = pts[4] || pts[1]
        const activeLeft = pts[61] || pts[78]
        const activeRight = pts[291] || pts[308]

        if (activeNose && activeLeft && activeRight) {
          // Vẽ các đường nối đo lường bất đối xứng
          ctx.strokeStyle = 'rgba(236, 72, 153, 0.8)' // Màu hồng neon nổi bật
          ctx.lineWidth = 2
          ctx.shadowColor = '#db2777'
          ctx.shadowBlur = 6

          // Đường nối từ mũi xuống khóe miệng trái
          ctx.beginPath()
          ctx.moveTo(activeNose.x, activeNose.y)
          ctx.lineTo(activeLeft.x, activeLeft.y)
          ctx.stroke()

          // Đường nối từ mũi xuống khóe miệng phải
          ctx.beginPath()
          ctx.moveTo(activeNose.x, activeNose.y)
          ctx.lineTo(activeRight.x, activeRight.y)
          ctx.stroke()

          // Đường ngang nối 2 khóe miệng
          ctx.beginPath()
          ctx.moveTo(activeLeft.x, activeLeft.y)
          ctx.lineTo(activeRight.x, activeRight.y)
          ctx.stroke()

          // Vẽ 3 điểm mốc màu hồng neon lớn hơn
          ctx.fillStyle = '#ec4899'
          ;[activeNose, activeLeft, activeRight].forEach((pt) => {
            ctx.beginPath()
            ctx.arc(pt.x, pt.y, 5.5, 0, 2 * Math.PI)
            ctx.fill()
          })
          ctx.shadowBlur = 0 // reset shadow
        }
      }

      if (activeTab === 'F') {
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
        ctx.fillRect(16, 16, 190, 34)
        ctx.fillStyle = lastFaceDetectedRef.current ? '#34d399' : '#f59e0b'
        ctx.font = 'bold 13px Inter, system-ui, sans-serif'
        ctx.fillText(
          lastFaceDetectedRef.current
            ? `Face OK - ${(lastFaceAsymmetryRef.current || 0).toFixed(1)}%`
            : 'Dang tim khuon mat...',
          28,
          38
        )
      }

      // ── DEBOUNCE ACCUMULATOR: Yêu cầu asymmetry > ngưỡng tích lũy ~10 giây ──
      if (activeTab === 'F' && !sosTriggered) {
        if (faceDetected && asymmetry > CLINICAL_FACE_TRIGGER_RATIO) {
          faceAccumulatedTimeRef.current += dt
          if (faceAccumulatedTimeRef.current > CLINICAL_FACE_ALERT_DURATION) {
            triggerSOS('Face Asymmetry')
            faceAccumulatedTimeRef.current = 0
          }
        } else {
          faceAccumulatedTimeRef.current = Math.max(0, faceAccumulatedTimeRef.current - dt * 2)
        }
      }

      // ===== Speech visual helpers (Active in Tab S) =====
      if (activeTab === 'S') {
        ctx.fillStyle = 'rgba(15, 23, 42, 0.85)'
        ctx.fillRect(20, 20, canvas.width - 40, 75)
        ctx.strokeStyle = '#3b82f6'
        ctx.lineWidth = 2
        ctx.strokeRect(20, 20, canvas.width - 40, 75)

        ctx.fillStyle = '#38bdf8'
        ctx.font = 'bold 18px Inter, system-ui, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Đang Nghe Giọng Nói...', canvas.width / 2, 48)

        ctx.fillStyle = '#94a3b8'
        ctx.font = '13px Inter, system-ui, sans-serif'
        ctx.fillText('Nói rõ: "Bầu trời hôm nay rất xanh"', canvas.width / 2, 75)
        ctx.textAlign = 'left' // restore
      }

    } catch (err) {
      console.warn('[FAST] Detection loop exception:', err)
    }

    rafRef.current = requestAnimationFrame(runDetectionLoop)
  }, [isRunning, activeTab, videoSource, triggerSOS])

  // ========== START / STOP DETECTOR ==========
  useEffect(() => {
    if (isRunning) {
      rafRef.current = requestAnimationFrame(runDetectionLoop)
    } else {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }

    return () => {
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current)
        rafRef.current = null
      }
    }
  }, [isRunning, runDetectionLoop])

  // Clear Canvas Utility
  const clearCanvas = () => {
    const ctx = canvasRef.current?.getContext('2d');
    if (ctx && canvasRef.current) {
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
  }

  // ========== WEBCAM CONTROL ==========
  const handleStartWebcam = async () => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: false,
      })

      const video = videoRef.current
      if (video) {
        video.src = ''
        video.srcObject = stream
        video.onloadedmetadata = () => {
          video.play().catch(e => console.warn('Play webcam error:', e))
        }
      }
      streamRef.current = stream
      clearCanvas()
      console.log('[FAST] Webcam initialized successfully.')
    } catch (err) {
      console.error('[FAST] Webcam activation failed:', err)
      alert('Không thể truy cập webcam. Vui lòng kiểm tra quyền camera.')
    }
  }

  // ========== FILE DEMO CONTROL ==========
  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (file) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      const url = URL.createObjectURL(file)
      const video = videoRef.current
      if (video) {
        video.srcObject = null
        video.src = url
        video.loop = true // Lặp lại video demo để AI có đủ thời gian phân tích
        video.muted = true // Đảm bảo video tắt tiếng để không bị trình duyệt chặn phát tự động
        video.onloadedmetadata = () => {
          video.play().catch(e => console.warn('Video file play error:', e))
        }
      }
      clearCanvas()
      resetSOSState()
      setIsRunning(true)
    }
  }

  // ========== IP CAMERA CONTROL ==========
  const handleConnectIPCamera = () => {
    if (!ipcameraUrl) {
      alert('Vui lòng nhập link IP Camera.')
      return
    }
    const video = videoRef.current
    if (video) {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
        streamRef.current = null
      }
      video.srcObject = null
      video.src = ipcameraUrl
      video.onloadedmetadata = () => {
        video.play().catch(e => console.warn('Play IP camera error:', e))
      }
      clearCanvas()
    }
  }

  const handleStopVideo = () => {
    setIsRunning(false)
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause()
      } catch (e) {}
    }
    if (streamRef.current) {
      try {
        streamRef.current.getTracks().forEach((track) => track.stop())
      } catch (e) {}
      streamRef.current = null
    }
  }

  // Dừng mọi luồng khi chuyển đổi nguồn videoSource
  useEffect(() => {
    handleStopVideo()
  }, [videoSource])

  const resetSOSState = () => {
    setSOSTriggered(false)
    setSOSType(null)
    setEmergencyAdvice('')
    sosReadyRef.current = false
    stopSiren()
    faceAccumulatedTimeRef.current = 0
    armDriftStartTimeRef.current = null
    fallAnomalyCountRef.current = 0
    prevShoulderYRef.current = null
    prevShoulderTimeRef.current = null
    fallAnomalyStartTimeRef.current = null
    lastPosePointsRef.current = null
    lastFacePointsRef.current = null
    lastArmAsymmetryRef.current = 0
    lastFaceAsymmetryRef.current = 0
    lastFaceDetectedRef.current = false
    faceLastTimeRef.current = performance.now()
    lastPoseTimeRef.current = 0
    lastFaceTimeRef.current = 0
    setSosSnapshot('')
  }

  const handleStartMonitoring = async () => {
    if (isLoadingModels || !!modelsError) {
      alert('Mô hình AI chưa sẵn sàng.')
      return
    }
    resetSOSState()
    if (videoSource === 'webcam' && (!streamRef.current || !videoRef.current?.srcObject)) {
      await handleStartWebcam()
    } else if (videoSource === 'ipcamera' && !videoRef.current?.src) {
      handleConnectIPCamera()
    }
    if (videoSource === 'upload' && videoRef.current) {
      videoRef.current.currentTime = 0
      videoRef.current.muted = true // Đảm bảo video tắt tiếng để không bị trình duyệt chặn phát tự động
      videoRef.current.play().catch(e => console.warn('Video file play error:', e))
    }
    setIsRunning(true)
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      stopSiren()
      if (speechTimeoutRef.current) clearTimeout(speechTimeoutRef.current)
      if (speechRecognitionRef.current) {
        try { speechRecognitionRef.current.abort() } catch (e) {}
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop())
      }
    }
  }, [stopSiren])

  return (
    <div className="p-3 sm:p-5 md:p-6 max-w-[1300px] mx-auto min-h-screen text-slate-800 font-sans selection:bg-rose-500/10 selection:text-slate-900">
      {/* CSS Injected Styles for Micro-animations */}
      <style>{`
        @keyframes soundwave {
          0%, 100% { height: 8px; }
          50% { height: 28px; }
        }
        .voice-bar {
          animation: soundwave 1.2s ease-in-out infinite;
        }
        .voice-bar:nth-child(2) { animation-delay: 0.15s; }
        .voice-bar:nth-child(3) { animation-delay: 0.3s; }
        .voice-bar:nth-child(4) { animation-delay: 0.45s; }
        .voice-bar:nth-child(5) { animation-delay: 0.6s; }
        @keyframes custom-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.98); }
        }
        .hud-pulse-glow {
          animation: custom-pulse 2s infinite ease-in-out;
        }
      `}</style>

      {/* Header Banner - High Tech Medical HUD */}
      <div className="flex flex-col md:flex-row items-center gap-3 mb-4 md:mb-5 bg-white/60 backdrop-blur-md p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-sm justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-red-50 p-2 rounded-xl border border-red-100 flex items-center justify-center">
            <Zap className="text-red-500 w-6.5 h-6.5 md:w-8 md:h-8" />
          </div>
          <div>
            <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight bg-gradient-to-r from-red-650 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              F.A.S.T Test Sinh Tồn
            </h1>
            <p className="text-[10px] sm:text-[11px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Quy trình Y khoa phát hiện Đột quỵ sớm</p>
          </div>
        </div>

        {/* Live Status Badge & Guide Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGuideModal(true)}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-lg font-black text-[11px] transition border border-blue-200/50 flex items-center gap-1.5 cursor-pointer shadow-sm active:scale-95 duration-150"
          >
            <BookOpen size={12} className="text-blue-600" /> Quy trình Y khoa
          </button>

          <div className="flex-shrink-0">
            {sosTriggered ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-extrabold text-xs uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                🚨 Cấp cứu Đột quỵ!
              </div>
            ) : isLoadingModels ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 font-bold text-xs uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                Đang tải mô hình AI
              </div>
            ) : isRunning ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-50 border border-blue-200 text-blue-700 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping"></span>
                AI Đang quét LIVE
              </div>
            ) : (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                Hệ thống Sẵn sàng
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex flex-col lg:flex-row gap-4 md:gap-5">
        {/* Left Column: Camera and Control Panel */}
        <div className="flex-1 max-w-[800px] w-full flex flex-col gap-3">
          <div className="bg-white/60 p-3 sm:p-4 rounded-xl border border-slate-200/80 shadow-sm backdrop-blur-md">
            {/* Video Source Selectors */}
            <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-100 p-1.5 rounded-xl mb-4 border border-slate-200/50">
              <button 
                type="button"
                onClick={() => setVideoSource('webcam')}
                className={`flex-1 min-w-[100px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-extrabold text-xs sm:text-sm transition-all ${
                  videoSource === 'webcam' 
                    ? 'bg-blue-600 text-white shadow-sm hover:bg-blue-700' 
                    : 'bg-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Video className="w-4 h-4" /> Webcam
              </button>
              <button 
                type="button"
                onClick={() => setVideoSource('upload')}
                className={`flex-1 min-w-[100px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-extrabold text-xs sm:text-sm transition-all ${
                  videoSource === 'upload' 
                    ? 'bg-indigo-600 text-white shadow-sm hover:bg-indigo-700' 
                    : 'bg-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Upload className="w-4 h-4" /> Video Demo
              </button>
              <button 
                type="button"
                onClick={() => setVideoSource('ipcamera')}
                className={`flex-1 min-w-[100px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-extrabold text-xs sm:text-sm transition-all ${
                  videoSource === 'ipcamera' 
                    ? 'bg-teal-650 text-white shadow-sm hover:bg-teal-750' 
                    : 'bg-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Link2 className="w-4 h-4" /> IP Camera
              </button>
            </div>

            {/* Video File Uploader Panel */}
            {videoSource === 'upload' && (
              <div className="mb-4 bg-indigo-50/50 p-4 rounded-xl border border-indigo-100/60 flex flex-col gap-2 transition-all">
                <span className="text-xs text-indigo-700 font-bold uppercase tracking-wider">Tải lên Video bệnh nhân mẫu (.mp4, .webm)</span>
                <input 
                  type="file" 
                  accept="video/mp4,video/webm" 
                  onChange={handleFileUpload} 
                  className="w-full text-xs text-slate-600 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-indigo-600 file:text-white hover:file:bg-indigo-500 cursor-pointer" 
                />
              </div>
            )}

            {/* IP Camera Configuration Form */}
            {videoSource === 'ipcamera' && (
              <div className="flex flex-col gap-3 mb-4 bg-teal-50/30 p-4 rounded-xl border border-teal-100 transition-all">
                <span className="text-xs text-teal-800 font-bold uppercase tracking-wider">Kết nối luồng Camera IP</span>
                <div className="flex flex-col sm:flex-row gap-2">
                  <input 
                    type="text" 
                    value={ipcameraUrl} 
                    onChange={(e) => setIpcameraUrl(e.target.value)} 
                    placeholder="Nhập link luồng (ví dụ: http://192.168.1.100/live.m3u8)"
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500 transition-all placeholder:text-slate-400"
                  />
                  <button 
                    type="button"
                    onClick={handleConnectIPCamera} 
                    className="bg-teal-650 hover:bg-teal-700 text-white px-6 py-2.5 rounded-xl font-extrabold text-xs sm:text-sm transition-all"
                  >
                    Kết nối
                  </button>
                </div>
                <div className="flex items-start gap-2 bg-teal-50/70 p-3 rounded-lg border border-teal-100 text-[11px] text-teal-850 leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-teal-600" />
                  <div>
                    <span className="font-extrabold block mb-0.5">⚠️ Hướng dẫn nhà phát triển:</span>
                    Trình duyệt web không hỗ trợ giao thức camera thô như <code>rtsp://</code> hoặc luồng JPEG tĩnh. Vui lòng chuyển đổi luồng camera thành luồng <strong>HLS (.m3u8)</strong>, <strong>WebRTC</strong> hoặc sử dụng server proxy video để kết nối hiển thị.
                  </div>
                </div>
              </div>
            )}

            {/* Camera Viewport (Standard canvas) */}
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-md group">
              <video ref={videoRef} className="absolute inset-0 w-full h-full object-contain" autoPlay playsInline muted width={640} height={480} />
              <canvas ref={canvasRef} width={640} height={480} className="absolute inset-0 w-full h-full object-contain pointer-events-none" />
              
              {/* HUD Frame decoration overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* 4 Corners brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-sm transition-all group-hover:scale-105" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-sm transition-all group-hover:scale-105" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80 rounded-bl-sm transition-all group-hover:scale-105" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80 rounded-br-sm transition-all group-hover:scale-105" />

                {/* Model ready pill status badges */}
                {!isLoadingModels && !sosTriggered && isRunning && (
                  <div className="absolute bottom-4 left-4 flex gap-2">
                    <span className="bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[10px] text-emerald-400 font-extrabold px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span> FaceMesh
                    </span>
                    <span className="bg-slate-900/80 backdrop-blur-md border border-slate-800 text-[10px] text-cyan-400 font-extrabold px-2 py-1 rounded-md flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse"></span> MoveNet
                    </span>
                  </div>
                )}
              </div>

              {/* Placeholder overlay when camera is off */}
              {!isRunning && (
                <div className="absolute inset-0 bg-slate-50/98 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm z-10 border border-slate-200 rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-400 shadow-sm">
                    <Video size={28} className="text-slate-400 animate-pulse" />
                  </div>
                  <h3 className="font-extrabold text-slate-700 text-sm sm:text-base mb-2">
                    {videoSource === 'webcam' && "Thiết bị F.A.S.T đang tắt"}
                    {videoSource === 'upload' && "Video chạy thử đang dừng"}
                    {videoSource === 'ipcamera' && "Kết nối IP Camera đang tắt"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                    {videoSource === 'webcam' && "Quy trình F.A.S.T chưa mở webcam. Nhấn nút bên dưới để cấp quyền quét cơ mặt và liệt cánh tay."}
                    {videoSource === 'upload' && "Chọn file video bệnh nhân mẫu và nhấn nút bên dưới để AI mô phỏng phân tích y khoa."}
                    {videoSource === 'ipcamera' && "Nhập địa chỉ luồng camera IP được hỗ trợ và nhấn nút bên dưới để liên kết camera."}
                  </p>
                  <button
                    type="button"
                    onClick={handleStartMonitoring}
                    disabled={isLoadingModels || (videoSource === 'ipcamera' && !ipcameraUrl)}
                    className={`px-8 py-3 text-white rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center gap-2 hover:scale-[1.02] active:scale-95 duration-200 ${
                      videoSource === 'ipcamera' && !ipcameraUrl
                        ? "bg-slate-100 text-slate-400 border border-slate-250 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 shadow-blue-200/30"
                    }`}
                  >
                    {videoSource === 'webcam' && "Mở Webcam"}
                    {videoSource === 'upload' && "Bật Video Demo"}
                    {videoSource === 'ipcamera' && "Khởi động Kết nối"}
                  </button>
                </div>
              )}

              {/* Models loading spinner */}
              {isLoadingModels && (
                <div className="absolute inset-0 bg-slate-50/98 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-slate-200 rounded-full animate-spin mb-4"></div>
                  <h3 className="text-base font-extrabold text-slate-700 tracking-wide">Đang khởi động Mô hình AI...</h3>
                  <p className="text-xs text-slate-500 mt-1">Quá trình này chỉ diễn ra ở lần chạy đầu tiên</p>
                </div>
              )}
            </div>

            {/* Main Action Start/Stop Analyzer Button */}
            <div className="mt-3">
              <button
                type="button"
                disabled={isLoadingModels}
                onClick={() => isRunning ? handleStopVideo() : handleStartMonitoring()}
                className={`w-full py-3 rounded-lg font-extrabold text-xs sm:text-sm tracking-wide transition-all transform hover:scale-[1.01] active:scale-95 shadow-sm ${
                  isRunning 
                    ? 'bg-gradient-to-r from-rose-500 to-red-655 hover:from-rose-600 hover:to-red-750 text-white shadow-rose-200/20' 
                    : 'bg-gradient-to-r from-emerald-500 to-teal-650 hover:from-emerald-650 hover:to-teal-750 text-white shadow-emerald-200/20'
                }`}
              >
                {isRunning ? 'DỪNG PHÂN TÍCH LÂM SÀNG' : 'BẮT ĐẦU PHÂN TÍCH AI (F.A.S.T)'}
              </button>
            </div>
          </div>
        </div>

        {/* Right Column: Diagnostic Tabs and Information */}
        <div className="w-full lg:w-[420px] flex flex-col gap-4">
          {/* Diagnostic Step Tab buttons */}
          <div className="bg-white/80 p-1 rounded-xl border border-slate-200/80 shadow-sm flex justify-between gap-1">
            {[
              { id: 'F', step: 'F', label: 'Face (Mặt)' },
              { id: 'A', step: 'A', label: 'Arms (Tay)' },
              { id: 'S', step: 'S', label: 'Speech (Nói)' },
              { id: 'T', step: 'T', label: 'SOS / Tin' },
              { id: 'H', step: '♥', label: 'Nhịp Tim' },
            ].map((tab) => {
              const isActive = activeTab === tab.id;
              let activeColorClass = "";
              if (isActive) {
                if (tab.id === 'F') activeColorClass = "bg-emerald-50 border border-emerald-200 text-emerald-700 shadow-sm";
                if (tab.id === 'A') activeColorClass = "bg-cyan-50 border border-cyan-200 text-cyan-700 shadow-sm";
                if (tab.id === 'S') activeColorClass = "bg-blue-50 border border-blue-200 text-blue-700 shadow-sm";
                if (tab.id === 'T') activeColorClass = "bg-rose-50 border border-rose-200 text-rose-700 shadow-sm animate-pulse";
                if (tab.id === 'H') activeColorClass = "bg-pink-50 border border-pink-200 text-pink-700 shadow-sm";
              }
              return (
                <button 
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`flex-1 py-1.5 rounded-lg transition-all border border-transparent text-center font-extrabold cursor-pointer ${
                    isActive ? activeColorClass : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <div className="font-black text-sm sm:text-base mb-0.5">{tab.step}</div>
                  <div className="text-[8px] sm:text-[9px] font-extrabold uppercase tracking-wide">{tab.label}</div>
                </button>
              );
            })}
          </div>

          {/* Details Content Card */}
          <div className="bg-white/80 p-4 sm:p-5 rounded-xl border border-slate-200/80 shadow-sm backdrop-blur-sm flex-1 flex flex-col justify-between min-h-[340px]">
            
            {/* Tab F: FACE */}
            {activeTab === 'F' && (
              <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-250/60 pb-3">
                    <span className="w-1.5 h-3 bg-emerald-500 rounded-full"></span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">F - Face (Khuôn mặt)</h2>
                  </div>
                  
                  {/* Asymmetry progress bar */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between items-center mb-1.5 text-xs text-slate-500 font-bold uppercase tracking-wider">
                        <span>Chỉ số bất đối xứng cơ mặt</span>
                        <span className={
                          (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO 
                            ? "text-rose-600 animate-pulse font-black" 
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO 
                              ? "text-amber-600 font-bold" 
                              : "text-emerald-600 font-bold"
                        }>
                          {(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%
                        </span>
                      </div>
                      <div className="relative h-2 w-full bg-slate-100 rounded-full border border-slate-200/50 p-0 overflow-visible">
                        <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full opacity-90" />
                        
                        {/* Threshold vertical markers */}
                        <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-slate-400/30" />
                        <div className="absolute top-0 bottom-0 left-[80%] w-0.5 bg-slate-400/30" />
                        
                        {/* Value Pointer Pin */}
                        <div 
                          className="absolute -top-1.5 h-5 w-5 bg-white border-2 border-slate-800 rounded-full shadow-md transition-all duration-150"
                          style={{ left: `calc(${Math.min(100, ((detectionMetrics?.faceAsymmetry || 0) / 10) * 100)}% - 10px)` }}
                        />
                      </div>
                      <div className="hidden justify-between text-[10px] text-slate-500 mt-2 font-bold tracking-wide">
                        <span>0% (Cân đối)</span>
                        <span className="text-amber-600/80">3% (Cảnh báo)</span>
                        <span className="text-rose-600/80">5% (Méo miệng)</span>
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold tracking-wide">
                        <span>0% (Theo doi)</span>
                        <span className="text-amber-600/80">5% (Kiem chung)</span>
                        <span className="text-rose-600/80">8% (Nghi ngo)</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                      (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO
                          ? "bg-amber-50 border-amber-200 text-amber-800"
                          : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}>
                      <div className="mt-0.5 flex-shrink-0">
                        {(detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO ? (
                          <ShieldAlert className="w-5 h-5 text-rose-600" />
                        ) : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO ? (
                          <AlertCircle className="w-5 h-5 text-amber-600" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">
                          {detectionMetrics?.faceDetected === false
                            ? "Chua nhan dien duoc khuon mat"
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO
                            ? "Nghi ngo duong tinh FAST: bat doi xung mat"
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO
                              ? "Can kiem chung lai thao tac Face"
                              : "Chua ghi nhan bat thuong ro"}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {detectionMetrics?.faceDetected === false
                            ? "Hay dua mat vao giua khung hinh, tranh nguoc sang va giu camera thay ro mat."
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO
                            ? `Chi so dang cao (${(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%). Lam lai Face test, kiem tra them Arms/Speech va doi chieu nguoi that truoc khi ket luan.`
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO
                              ? `Chi so trong vung can xac nhan (${(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%). Dat mat thang camera, anh sang deu, roi thuc hien lai cu dong.`
                              : "Chi so trong vung theo doi. Day la cong cu sang loc ho tro, khong thay the chan doan cua nhan vien y te."}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`hidden p-4 rounded-xl border flex items-start gap-3 transition-all ${
                      (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO 
                        ? "bg-rose-5 border-rose-100 text-rose-800 shadow-[0_0_12px_rgba(244,63,94,0.04)]" 
                        : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO 
                          ? "bg-amber-5 border-amber-100 text-amber-800" 
                          : "bg-emerald-5 border-emerald-100 text-emerald-850"
                    }`}>
                      <div className="mt-0.5 flex-shrink-0">
                        {(detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO ? (
                          <ShieldAlert className="w-5 h-5 text-rose-600" />
                        ) : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO ? (
                          <AlertCircle className="w-5 h-5 text-amber-550" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">
                          {(detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO 
                            ? "🚨 CẢNH BÁO: PHÁT HIỆN MÉO MIỆNG" 
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO 
                              ? "CẢNH BÁO: CƠ MẶT BẤT ĐỐI XỨNG" 
                              : "CƠ MẶT CÂN ĐỐI BÌNH THƯỜNG"
                          }
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {(detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_TRIGGER_RATIO 
                            ? `Phát hiện lệch cơ mặt rõ rệt (${(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%). Vui lòng thả lỏng mặt để AI đối chiếu.`
                            : (detectionMetrics?.faceAsymmetry || 0) >= CLINICAL_FACE_RESET_RATIO 
                              ? `Khóe miệng lệch nhẹ (${(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%). Hãy cười tươi hoặc há to miệng để kiểm chứng.`
                              : "Các điểm mốc khóe miệng đối xứng tốt. Không phát hiện dấu hiệu bất thường."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medical steps instructions */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-auto">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase mb-2">Chỉ dẫn thực hiện F:</h4>
                  <ul className="text-[11px] text-slate-500 space-y-1.5 leading-relaxed list-decimal pl-4">
                    <li>Cười thật tươi lộ rõ hai khóe miệng hướng về phía camera.</li>
                    <li>Há to miệng phát âm chữ O, nhướng chân mày hoặc phồng má.</li>
                    <li>Tránh nghiêng đầu hoặc quay lệch mặt khỏi ống kính.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab A: ARMS */}
            {activeTab === 'A' && (
              <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-250/60 pb-3">
                    <span className="w-1.5 h-3 bg-cyan-500 rounded-full"></span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">A - Arms (Tay & Yếu cơ chi)</h2>
                  </div>

                  {/* Arm drift progress bar */}
                  <div className="space-y-4 mb-6">
                    <div>
                      <div className="flex justify-between items-center mb-1.5 text-xs text-slate-505 font-bold uppercase tracking-wider">
                        <span>Độ lệch hai cổ tay</span>
                        <span className={
                          (detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD 
                            ? "text-rose-600 animate-pulse font-black" 
                            : "text-emerald-600 font-bold"
                        }>
                          {(detectionMetrics?.armAsymmetry || 0).toFixed(0)} px
                        </span>
                      </div>
                      <div className="relative h-2 w-full bg-slate-100 rounded-full border border-slate-200/50 p-0 overflow-visible">
                        <div className="h-full w-full bg-gradient-to-r from-emerald-500 via-amber-400 to-rose-500 rounded-full opacity-90" />
                        
                        {/* Threshold vertical marker */}
                        <div className="absolute top-0 bottom-0 left-[50%] w-0.5 bg-slate-400/30" />
                        
                        {/* Value Pointer Pin */}
                        <div 
                          className="absolute -top-1.5 h-5 w-5 bg-white border-2 border-slate-800 rounded-full shadow-md transition-all duration-150"
                          style={{ left: `calc(${Math.min(100, ((detectionMetrics?.armAsymmetry || 0) / 120) * 100)}% - 10px)` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-bold tracking-wide">
                        <span>0 px (Cân bằng)</span>
                        <span className="text-rose-600">60 px (Yếu cơ)</span>
                        <span>120 px+ (Liệt tay)</span>
                      </div>
                    </div>

                    <div className={`p-4 rounded-xl border flex items-start gap-3 transition-all ${
                      (detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD
                        ? "bg-rose-50 border-rose-200 text-rose-800"
                        : "bg-emerald-50 border-emerald-200 text-emerald-800"
                    }`}>
                      <div className="mt-0.5 flex-shrink-0">
                        {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD ? (
                          <ShieldAlert className="w-5 h-5 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">
                          {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD
                            ? "Nghi ngo yeu/roi tay trong Arms test"
                            : "Hai tay dang giu tu the can bang"}
                        </h4>
                        <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">
                          {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD
                            ? `Do lech co tay dang cao (${(detectionMetrics?.armAsymmetry || 0).toFixed(0)} px). Yeu cau giu hai tay 5 giay va doi chieu them Face/Speech.`
                            : "Chua ghi nhan do roi tay ro. Dam bao camera thay du vai, khuyu tay va co tay hai ben."}
                        </p>
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className={`hidden p-4 rounded-xl border flex items-start gap-3 transition-all ${
                      (detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD 
                        ? "bg-rose-5 border-rose-100 text-rose-800 shadow-[0_0_12px_rgba(244,63,94,0.04)]" 
                        : "bg-emerald-5 border-emerald-100 text-emerald-850"
                    }`}>
                      <div className="mt-0.5 flex-shrink-0">
                        {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD ? (
                          <ShieldAlert className="w-5 h-5 text-rose-600" />
                        ) : (
                          <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                        )}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-xs uppercase tracking-wider">
                          {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD 
                            ? "🚨 CẢNH BÁO: PHÁT HIỆN YẾU / RỦ TAY" 
                            : "CƠ LỰC HAI TAY CÂN BẰNG"
                          }
                        </h4>
                        <p className="text-[11px] text-slate-500 mt-1 leading-relaxed">
                          {(detectionMetrics?.armAsymmetry || 0) >= CLINICAL_ARM_DRIFT_THRESHOLD 
                            ? `Một bên cánh tay bị hạ thấp rõ rệt (${(detectionMetrics?.armAsymmetry || 0).toFixed(0)} px). Vui lòng ngồi xuống để tránh ngã và giữ thẳng hai tay.`
                            : "Hai tay nâng đều ổn định. Không phát hiện chênh lệch lực cơ chi trên."
                          }
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Medical steps instructions */}
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mt-auto">
                  <h4 className="text-xs font-extrabold text-slate-700 uppercase mb-2">Chỉ dẫn thực hiện A:</h4>
                  <ul className="text-[11px] text-slate-500 space-y-1.5 leading-relaxed list-decimal pl-4">
                    <li>Lùi ra sau cách camera khoảng 1.5 - 2 mét để AI thấy toàn bộ từ vai đến cổ tay.</li>
                    <li>Giơ thẳng hai tay song song phía trước thân mình tạo góc 90 độ.</li>
                    <li>Giữ yên tư thế trong 5 giây. Nếu một bên tay tự động rơi xuống, hãy cẩn thận.</li>
                  </ul>
                </div>
              </div>
            )}

            {/* Tab S: SPEECH */}
            {activeTab === 'S' && (
              <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                <div>
                  <div className="flex items-center gap-2 mb-3 border-b border-slate-250/60 pb-3">
                    <span className="w-1.5 h-3 bg-blue-500 rounded-full"></span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">S - Speech (Giọng nói & Phát âm)</h2>
                  </div>

                  {/* File demo alert */}
                  {videoSource === 'upload' && (
                    <div className="bg-blue-5 p-3 rounded-xl mb-3 text-[11px] text-blue-800 leading-relaxed border border-blue-105">
                      <span className="font-extrabold text-amber-600">💡 Chú ý Video Demo:</span>
                      Web Speech API dùng <strong>Micro thực tế của máy</strong> để nhận diện. Bạn hãy <strong>đọc to câu mẫu</strong> thay cho video nếu micro không bắt được tiếng loa.
                    </div>
                  )}

                  {/* Target Phrase Box */}
                  <div className="bg-slate-900 p-4 rounded-xl border border-slate-955 text-center mb-4 relative overflow-hidden shadow-inner">
                    <span className="absolute top-2 left-2 text-[9px] font-extrabold text-slate-550 uppercase tracking-wider">Đọc to cụm từ này:</span>
                    <p className="text-base sm:text-lg font-black text-white tracking-wide mt-2">
                      "Bầu trời hôm nay rất xanh"
                    </p>
                  </div>

                  {/* Listening status widget */}
                  <div className="mb-4">
                    {speechStatus === 'listening' && (
                      <div className="p-3.5 bg-blue-50 border border-blue-100 rounded-xl text-blue-850 flex flex-col items-center gap-2 shadow-sm">
                        <div className="flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-blue-700">
                          <Mic className="w-4 h-4 text-blue-600 animate-pulse" /> Đang lắng nghe âm thanh...
                        </div>
                        {/* Audio Waveform Pulse animation */}
                        <div className="flex items-end justify-center gap-1.5 h-8 my-1">
                          <span className="w-1 bg-blue-500 rounded-full voice-bar" />
                          <span className="w-1 bg-blue-400 rounded-full voice-bar" />
                          <span className="w-1 bg-cyan-500 rounded-full voice-bar" />
                          <span className="w-1 bg-blue-400 rounded-full voice-bar" />
                          <span className="w-1 bg-blue-500 rounded-full voice-bar" />
                        </div>
                      </div>
                    )}
                    {speechStatus === 'retry' && (
                      <div className="p-3 bg-amber-50 border border-amber-100 rounded-xl text-amber-800 text-xs font-bold text-center flex items-center justify-center gap-2">
                        <AlertCircle className="w-4 h-4 text-amber-600" />
                        Không rõ âm thanh. Vui lòng đọc to, rõ ràng câu mẫu lại.
                      </div>
                    )}
                    {speechStatus === 'success' && (
                      <div className="p-3 bg-emerald-55 border border-emerald-100 rounded-xl text-emerald-800 text-xs font-bold text-center flex items-center justify-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-550" />
                        Phát âm rõ ràng. Cử động môi lưỡi đối xứng tốt.
                      </div>
                    )}
                    {speechStatus === 'error' && (
                      <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-700 text-xs font-bold text-center flex items-center justify-center gap-2 animate-pulse">
                        <ShieldAlert className="w-4 h-4 text-rose-600 animate-bounce" />
                        🚨 PHÁT HIỆN NÓI ĐỚ / LOẠN NGÔN. Khó phát âm câu mẫu chuẩn xác.
                      </div>
                    )}

                    {speechTranscript && (
                      <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 shadow-inner">
                        <span className="text-[9px] text-slate-400 font-extrabold uppercase tracking-wider block">AI thu được:</span>
                        <p className="text-slate-800 font-extrabold text-xs sm:text-sm mt-1 italic">"{speechTranscript}"</p>
                      </div>
                    )}
                  </div>
                </div>

                <button 
                  type="button"
                  onClick={startSpeechTest} 
                  className="w-full mt-auto py-3.5 bg-blue-600 hover:bg-blue-500 text-white transition-all rounded-xl font-extrabold text-xs sm:text-sm shadow-md shadow-blue-100/50 flex items-center justify-center gap-2 hover:scale-[1.01] active:scale-95"
                >
                  <Mic className="w-4 h-4" />
                  {speechStatus === 'listening' ? 'Hệ thống đang nghe...' : 'Bắt đầu kiểm tra giọng nói'}
                </button>
              </div>
            )}

            {/* Tab T: TIME & SOS */}
            {activeTab === 'T' && (
              <div className="flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                <div>
                  <div className="flex items-center gap-2 mb-4 border-b border-slate-250/60 pb-3">
                    <span className="w-1.5 h-3 bg-rose-500 rounded-full"></span>
                    <h2 className="text-base sm:text-lg font-bold text-slate-800">T - Time (Báo động & SOS)</h2>
                  </div>

                  {sosTriggered ? (
                    <div className="flex flex-col gap-4">
                      {/* Emergency Alert Header Card */}
                      <div className="bg-gradient-to-r from-red-500 to-rose-605 border border-red-400/30 p-4 rounded-xl text-center shadow-md">
                        <span className="bg-red-900/40 text-[10px] text-white px-2.5 py-0.5 rounded-full font-black uppercase tracking-widest mb-1.5 inline-block">Cảnh báo khẩn</span>
                        <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-wide">
                          Phát hiện dấu hiệu đột quỵ
                        </h3>
                        <p className="text-xs text-red-100 mt-1 font-bold">
                          Dạng phát hiện: <span className="underline">{sosType}</span>
                        </p>
                      </div>

                      {/* Display the snapshot image right below the alert header */}
                      {sosSnapshot && (
                        <div className="rounded-xl overflow-hidden border border-slate-200 relative h-28 sm:h-32 flex justify-center bg-slate-950 shadow-sm animate-scale-in">
                          <img src={sosSnapshot} alt="Cắt ảnh đột quỵ" className="h-full object-contain" />
                          <div className="absolute top-2 right-2 bg-red-650/90 text-white text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shadow-md">
                            📷 Ảnh cắt từ AI (F.A.S.T)
                          </div>
                        </div>
                      )}

                      {/* Gemini Advice Container */}
                      <div className="bg-slate-50 border border-slate-200 p-4 rounded-xl min-h-[160px] flex flex-col justify-center shadow-inner">
                        {loadingAdvice ? (
                          <div className="flex flex-col items-center justify-center py-6 gap-3">
                            <RefreshCw className="w-6 h-6 text-rose-500 animate-spin" />
                            <p className="text-xs text-slate-500 font-extrabold tracking-wide text-center">Bác sĩ AI đang chẩn đoán hình ảnh và chuẩn bị lời khuyên sơ cứu...</p>
                          </div>
                        ) : emergencyAdvice ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-1.5 border-b border-slate-200 pb-2">
                              <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
                              <h4 className="text-xs font-black text-rose-700 uppercase tracking-wide">Lời khuyên sơ cứu của Bác sĩ AI:</h4>
                            </div>
                            <p className="text-xs sm:text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                              {emergencyAdvice}
                            </p>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-6 text-slate-450 text-xs italic text-center">
                            Chưa nhận được đề xuất sơ cứu từ hệ thống. Hãy gọi ngay 115!
                          </div>
                        )}
                      </div>

                      {/* Call 115 CTA action button */}
                      <a
                        href="tel:115"
                        className="w-full py-4 bg-gradient-to-r from-red-600 to-rose-650 hover:from-red-500 hover:to-rose-600 text-white font-black rounded-xl text-center shadow-lg shadow-red-200/50 flex items-center justify-center gap-3 transition transform hover:scale-[1.01] active:scale-95 text-base sm:text-lg"
                      >
                        <Phone className="w-5 h-5 animate-bounce" /> GỌI KHẨN CẤP 115
                      </a>

                      {/* Reset System Trigger */}
                      <button
                        type="button"
                        id="btn-reset-sos"
                        onClick={resetSOSState}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 border border-slate-200/80 text-slate-700 font-bold rounded-xl text-xs transition"
                      >
                        🔄 Hủy Báo Động & Đặt Lại Thiết Bị
                      </button>
                    </div>
                  ) : (
                    /* Stroke Golden Hours Info Card */
                    <div className="space-y-4 animate-in fade-in">
                      <div className="flex items-center gap-3 p-3.5 bg-rose-50 border border-rose-100 rounded-xl">
                        <Clock className="w-10 h-10 text-rose-500 flex-shrink-0" />
                        <div>
                          <h4 className="text-xs font-black text-rose-700 uppercase tracking-wide">Quy tắc Giờ Vàng (4.5 Giờ)</h4>
                          <p className="text-[11px] text-slate-500 mt-0.5 leading-relaxed">
                            Cấp cứu y tế đặc biệt cho đột quỵ hiệu quả nhất trong <strong>4.5 giờ đầu tiên</strong> kể từ khi xuất hiện dấu hiệu bất thường.
                          </p>
                        </div>
                      </div>

                      <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3 shadow-inner">
                        <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider block">Nguyên tắc sơ cứu cần nhớ:</span>
                        <ul className="text-[11px] text-slate-650 space-y-2 leading-relaxed list-disc pl-4">
                          <li><strong>Gọi cấp cứu 115</strong> lập tức khi phát hiện méo miệng, yếu tay hoặc nói đớ.</li>
                          <li><strong>Ghi nhớ thời điểm</strong> chính xác triệu chứng đầu tiên khởi phát.</li>
                          <li>Để người bệnh <strong>nằm đầu cao 30 độ</strong> ở nơi thông thoáng khí.</li>
                          <li><strong>Tuyệt đối không</strong> tự ý châm kim đầu ngón tay, cạo gió, hay cho bệnh nhân uống thuốc, uống nước chanh.</li>
                        </ul>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ===== Tab H: HEART RATE (BPM) ===== */}
            {activeTab === 'H' && (
              <div className="flex-1 flex flex-col gap-4 animate-in fade-in duration-200">

                {/* Header */}
                <div className="flex items-center gap-2 border-b border-slate-200/60 pb-3">
                  <span className="w-1.5 h-3 bg-pink-500 rounded-full"></span>
                  <h2 className="text-base sm:text-lg font-bold text-slate-800">♥ Theo dõi Nhịp tim Thời gian thực</h2>
                </div>

                {/* Tachycardia Alert */}
                {bpmAlert && (
                  <div className="rounded-xl border border-red-300 bg-red-50 p-3 animate-pulse">
                    <p className="text-[11px] font-bold text-red-700 leading-relaxed">
                      ⚠️ <strong>HỆ THỐNG ISOLATION FOREST PHÁT HIỆN RỦI RO:</strong> Nhịp tim nhanh bất thường (<em>Tachycardia</em>)!
                      Bác sĩ AI (Gemini) khuyến cáo bệnh nhân dừng ngay mọi hoạt động, ngồi nghỉ ngơi và chuẩn bị gọi SOS nếu kèm triệu chứng tức ngực.
                    </p>
                  </div>
                )}

                {/* BPM Readout */}
                <div className={`rounded-2xl border p-4 flex flex-col items-center justify-center gap-1 transition-all ${
                  bpmAlert ? 'bg-red-50 border-red-200' : 'bg-pink-50/60 border-pink-100'
                }`}>
                  <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Nhịp tim hiện tại</span>
                  <div className={`text-5xl font-black tabular-nums leading-none ${bpmAlert ? 'text-red-600' : 'text-pink-600'}`}>
                    {currentBpm !== null ? currentBpm : '—'}
                  </div>
                  <span className={`text-sm font-bold ${bpmAlert ? 'text-red-500' : 'text-slate-500'}`}>BPM</span>
                  {isBluetoothConnected && (
                    <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wider text-blue-600 flex items-center gap-1">
                      <Bluetooth size={10} /> Bluetooth đang kết nối
                    </span>
                  )}
                  {isSimulating && !isBluetoothConnected && (
                    <span className="mt-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-600 flex items-center gap-1">
                      <Activity size={10} className="animate-pulse" /> Đang mô phỏng
                    </span>
                  )}
                </div>

                {/* Control Buttons */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={connectBluetooth}
                    disabled={isBluetoothConnected || isSimulating}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold transition cursor-pointer shadow-md shadow-blue-200/40"
                  >
                    <Bluetooth size={13} /> Kết nối Smartwatch
                  </button>
                  <button
                    type="button"
                    onClick={startSimulation}
                    disabled={isSimulating || isBluetoothConnected}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-extrabold transition cursor-pointer shadow-md shadow-amber-200/40"
                  >
                    <Play size={13} /> Chạy Demo
                  </button>
                  <button
                    type="button"
                    onClick={stopHeartRate}
                    className="flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-200 hover:bg-red-100 hover:text-red-700 text-slate-600 text-xs font-extrabold transition cursor-pointer"
                  >
                    <Square size={13} /> Dừng
                  </button>
                </div>

                {/* Line Chart */}
                <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-inner">
                  <p className="text-[9px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">Biểu đồ nhịp tim (BPM)</p>
                  {hrChartData.length === 0 ? (
                    <div className="h-[220px] flex items-center justify-center text-[11px] text-slate-400 italic">
                      Nhấn "Chạy Demo" hoặc kết nối Smartwatch để bắt đầu...
                    </div>
                  ) : (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={hrChartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                        <XAxis dataKey="time" tick={{ fontSize: 8, fill: '#94a3b8' }} interval="preserveStartEnd" />
                        <YAxis domain={[50, 150]} tick={{ fontSize: 9, fill: '#94a3b8' }} />
                        <Tooltip
                          contentStyle={{ fontSize: 11, borderRadius: 8, border: '1px solid #e2e8f0' }}
                          formatter={(v) => [`${v} BPM`, 'Nhịp tim']}
                        />
                        <Line
                          type="monotone"
                          dataKey="bpm"
                          stroke={bpmAlert ? '#ef4444' : '#ec4899'}
                          strokeWidth={2}
                          dot={false}
                          isAnimationActive={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  )}
                </div>

                {/* Gemini Advice Card */}
                {(hrAdviceLoading || hrAdvice) && (
                  <div className={`rounded-2xl border p-4 ${hrAdviceLoading ? 'bg-slate-50 border-slate-200' : 'bg-red-50 border-red-200'}`}>
                    {hrAdviceLoading ? (
                      <div className="flex items-center gap-2">
                        <RefreshCw className="w-4 h-4 text-rose-500 animate-spin flex-shrink-0" />
                        <p className="text-xs text-slate-500 font-bold">Bác sĩ AI (Gemini) đang phân tích nhịp tim bất thường...</p>
                      </div>
                    ) : hrAdvice && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Heart className="w-4 h-4 text-red-500 animate-pulse flex-shrink-0" />
                          <span className="text-[10px] font-extrabold text-red-700 uppercase tracking-wider">
                            Lời khuyên Bác sĩ AI — Mức: {hrAdvice.severity}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-700 leading-relaxed whitespace-pre-line font-medium">
                          {hrAdvice.advice}
                        </p>
                        <p className="text-[9px] text-slate-400 italic">✨ Phân tích bởi Google Gemini 2.0 Flash</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Model info */}
                <p className="text-[10px] text-slate-400 italic">
                  🤖 <strong>Web Bluetooth API</strong> — đọc Heart Rate Service (0x180D) từ thiết bị BLE.&nbsp;
                  ✨ <strong>Isolation Forest</strong> (logic) — phát hiện bất thường nhịp tim, cảnh báo Tachycardia &gt;100 BPM. Gemini tư vấn khi BPM &gt;120.
                </p>
              </div>

            )}
          </div>

        </div>
      </div>

      {/* MEDICAL GUIDE MODAL */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-2xl w-full border border-slate-200 shadow-2xl p-5 sm:p-6 animate-scale-in max-h-[90vh] overflow-y-auto relative text-left">
            <button
              onClick={() => setShowGuideModal(false)}
              className="absolute top-4 right-4 p-1.5 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition cursor-pointer"
              title="Đóng hướng dẫn"
            >
              <X size={18} />
            </button>

            <div className="flex items-center gap-2.5 border-b border-slate-150 pb-3 mb-4">
              <div className="p-2 bg-blue-50 border border-blue-100 text-blue-600 rounded-lg">
                <BookOpen size={20} />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight">
                  Quy trình Sàng lọc Lâm sàng F.A.S.T
                </h2>
                <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider mt-0.5">
                  Dành cho nhân viên y tế & bác sĩ chẩn đoán sớm đột quỵ
                </p>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 leading-relaxed mb-3 font-medium">
              Hệ thống sử dụng camera AI phân tích biểu hiện lâm sàng của bệnh nhân nghi ngờ đột quỵ cấp. Vui lòng làm theo chỉ dẫn để có kết quả tốt nhất:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-5">
              {/* Card F */}
              <div className="p-3 rounded-xl bg-emerald-50/50 border border-emerald-100/80 flex gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-emerald-200">
                  F
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs sm:text-sm">Face (Cơ mặt)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                    <strong>Yêu cầu:</strong> Cười tươi, nhướng mày hoặc há to miệng.
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    <strong>AI nhận diện:</strong> Đo độ lệch khóe miệng & mũi. Cảnh báo lệch ≥8% liên tục 3s.
                  </p>
                  <p className="text-[9px] text-slate-400 italic mt-1 leading-normal">🤖 <strong>MediaPipe FaceMesh</strong> (468 mốc) — offline trình duyệt, &lt;30ms.</p>
                </div>
              </div>

              {/* Card A */}
              <div className="p-3 rounded-xl bg-cyan-50/50 border border-cyan-100/80 flex gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-cyan-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-cyan-200">
                  A
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs sm:text-sm">Arms (Cánh tay)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                    <strong>Yêu cầu:</strong> Giơ hai tay thẳng về trước (90°), úp bàn tay.
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    <strong>AI nhận diện:</strong> Đo khớp vai & cổ tay. Cảnh báo lệch hạ thấp &gt;60px liên tục 1.5s.
                  </p>
                  <p className="text-[9px] text-slate-400 italic mt-1 leading-normal">🤖 <strong>MediaPipe Pose</strong> (33 khớp) — tracking real-time toàn thân.</p>
                </div>
              </div>

              {/* Card S */}
              <div className="p-3 rounded-xl bg-blue-50/50 border border-blue-100/80 flex gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-blue-200">
                  S
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs sm:text-sm">Speech (Giọng nói)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                    <strong>Yêu cầu:</strong> Đọc to câu mẫu: <em>"Bầu trời hôm nay rất xanh"</em>.
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    <strong>AI nhận diện:</strong> Web Speech API phân tích giọng. Cảnh báo nói đớ/loạn ngôn nếu độ khớp &lt;85%.
                  </p>
                  <p className="text-[9px] text-slate-400 italic mt-1 leading-normal">🎙️ <strong>Web Speech API</strong> — chạy trực tiếp trình duyệt Chrome/Edge.</p>
                </div>
              </div>

              {/* Card T */}
              <div className="p-3 rounded-xl bg-rose-50/50 border border-rose-100/80 flex gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-rose-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-rose-200">
                  T
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs sm:text-sm">Time (Báo động SOS)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                    <strong>Tác vụ khẩn:</strong> Kích hoạt còi hú, tự động chụp hình gửi cảnh báo cho người thân.
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    <strong>Bác sĩ AI:</strong> Gemini phân tích hình ảnh, khuyên sơ cứu tức thời trong "Giờ Vàng".
                  </p>
                  <p className="text-[9px] text-slate-400 italic mt-1 leading-normal">✨ <strong>Gemini 2.0 Flash</strong> — tư vấn sơ cứu khẩn cấp qua hình ảnh.</p>
                </div>
              </div>

              {/* Card H - full width */}
              <div className="p-3 rounded-xl bg-pink-50/50 border border-pink-100/80 flex gap-2.5 md:col-span-2">
                <div className="w-8 h-8 rounded-lg bg-pink-500 text-white font-black text-sm flex items-center justify-center shrink-0 shadow-sm shadow-pink-200">
                  ♥
                </div>
                <div>
                  <h4 className="font-extrabold text-slate-850 text-xs sm:text-sm">Heart Rate (Nhịp tim)</h4>
                  <p className="text-[10.5px] text-slate-500 leading-normal mt-0.5">
                    <strong>Yêu cầu:</strong> Kết nối Smartwatch BLE hoặc nhấn "Chạy Demo" mô phỏng thời gian thực.
                  </p>
                  <p className="text-[10.5px] text-slate-500 leading-normal">
                    <strong>AI phát hiện:</strong> Cảnh báo Tachycardia (BPM &gt; 100) — phát hiện bất thường bằng Isolation Forest.
                  </p>
                  <p className="text-[9px] text-slate-400 italic mt-1 leading-normal">🤖 <strong>BLE Bluetooth</strong> — đọc dữ liệu 0x180D trực tiếp từ Smartwatch.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 items-center justify-between border-t border-slate-100 pt-4">
              <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wide">
                🏥 Smart Healthcare System - Clinical Version
              </span>
              <button
                onClick={() => setShowGuideModal(false)}
                className="w-full sm:w-auto px-6 py-2 bg-blue-600 hover:bg-blue-700 active:scale-98 text-white font-extrabold text-xs rounded-xl shadow-md shadow-blue-200/40 transition duration-150 cursor-pointer text-center"
              >
                Bắt đầu Bài test Lâm sàng 🚀
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
