import React, { useState, useEffect, useRef, useCallback } from 'react'
import { AlertCircle, Eye, Zap, Mic, Clock, Shield, RefreshCw, Video, Upload, Link2, ShieldAlert } from 'lucide-react'
import * as tf from '@tensorflow/tfjs-core'
import '@tensorflow/tfjs-backend-webgl'
import '@tensorflow/tfjs-backend-cpu'
import * as faceLandmarksDetection from '@tensorflow-models/face-landmarks-detection'
import * as poseDetection from '@tensorflow-models/pose-detection'
import api from '../api/axios'
import { useSurveillance } from '../context/SurveillanceContext'

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

  // ========== REFS ==========
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
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

  // Debounce counters
  const faceAccumulatedTimeRef = useRef(0) // Đếm thời gian liên tiếp có face asymmetry > ngưỡng
  const faceLastTimeRef = useRef(performance.now())
  const fallAnomalyCountRef = useRef(0)  // Đếm khung hình liên tiếp có shoulder ≈ ankle

  // Ngưỡng debounce — đã hiệu chỉnh dựa trên dữ liệu video y khoa thực tế
  const FACE_ALERT_DURATION = 10000    // Phải duy trì méo miệng liên tục 10 giây (10000ms)
  const FALL_DEBOUNCE_THRESHOLD = 12   // >12 frame liên tiếp @ ~30fps
  const FACE_TRIGGER_RATIO = 8         // Tỷ lệ bất đối xứng > 8% thì count++ (y khoa: >5% là có dấu hiệu)
  const FACE_RESET_RATIO = 5           // Tỷ lệ < 5% thì reset count = 0
  const ARM_DRIFT_THRESHOLD = 60       // Chênh lệch Y cổ tay > 60px thì bắt đầu đếm thời gian
  const ARM_DRIFT_DURATION = 1500      // Giữ tay lệch > 1.5 giây thì trigger SOS
  const SPEECH_CONFIDENCE_THRESHOLD = 0.85 // Tăng độ nhạy (Web Speech API thường trả về >0.85 nếu nói rõ)

  // Siren refs for repeating sound
  const sirenIntervalRef = useRef(null)
  const audioCtxRef = useRef(null)

  // ========== LOAD MODELS (TENSORFLOW.JS) ==========
  useEffect(() => {
    let active = true

    const loadModels = async () => {
      // Avoid loading models multiple times
      if (modelsLoadedRef.current) {
        setIsLoadingModels(false)
        return
      }

      try {
        setIsLoadingModels(true)
        setModelsError(null)
        console.log('[FAST] Initializing TensorFlow.js backend...')
        await tf.ready()

        if (!active) return

        console.log('[FAST] Loading MediaPipe FaceMesh model...')
        const faceModel = faceLandmarksDetection.SupportedModels.MediaPipeFaceMesh
        const faceDetectorConfig = {
          runtime: 'tfjs', // Use tfjs local runtime for absolute stability
          refineLandmarks: true
        }
        const faceDetector = await faceLandmarksDetection.createDetector(faceModel, faceDetectorConfig)
        if (active) faceDetectorRef.current = faceDetector

        console.log('[FAST] Loading MoveNet Pose Detection model...')
        const poseModel = poseDetection.SupportedModels.MoveNet
        const poseDetectorConfig = {
          modelType: poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING
        }
        const poseDetector = await poseDetection.createDetector(poseModel, poseDetectorConfig)
        
        if (active) {
          poseDetectorRef.current = poseDetector
          modelsLoadedRef.current = true
          setIsLoadingModels(false)
          console.log('[FAST] All models loaded successfully!')
        }
      } catch (err) {
        console.error('[FAST] Error loading TensorFlow.js models:', err)
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
    let base64Image = ''
    if (canvas) {
      base64Image = canvas.toDataURL('image/jpeg', 0.8)
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

    try {
      const scaleX = canvas.width / video.videoWidth
      const scaleY = canvas.height / video.videoHeight

      // Draw current video frame on canvas (mirror for webcam feel)
      ctx.save()
      if (videoSource === 'webcam') {
        ctx.translate(canvas.width, 0)
        ctx.scale(-1, 1)
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      } else {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
      }
      ctx.restore()

      let poses = null

      // ===== Pose Detection (Runs in background for Fall Detection, active in Tab A) =====
      if (poseDetectorRef.current) {
        poses = await poseDetectorRef.current.estimatePoses(video)

        if (poses && poses.length > 0) {
          const pose = poses[0]
          const keypoints = pose.keypoints

          // Mirror and scale pose keypoints drawing
          const getCanvasPoint = (kp) => {
            const sx = kp.x * scaleX
            const sy = kp.y * scaleY
            if (videoSource === 'webcam') {
              return { x: canvas.width - sx, y: sy, score: kp.score, name: kp.name }
            }
            return { x: sx, y: sy, score: kp.score, name: kp.name }
          }

          const pts = keypoints.map(getCanvasPoint)

          // 1. Draw Pose landmarks on canvas
          if (activeTab === 'A') {
            // Draw skeleton lines for arms
            const findPt = (name) => pts.find(p => p.name === name && p.score > 0.3)
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
            const lSh = findPt('left_shoulder')
            const rSh = findPt('right_shoulder')
            const lEl = findPt('left_elbow')
            const rEl = findPt('right_elbow')
            const lWr = findPt('left_wrist')
            const rWr = findPt('right_wrist')

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

          // 2. Tab A (Liệt tay) Algorithm
          if (activeTab === 'A') {
            const leftWrist = pts.find((kp) => kp.name === 'left_wrist')
            const rightWrist = pts.find((kp) => kp.name === 'right_wrist')

            if (leftWrist && rightWrist && leftWrist.score > 0.3 && rightWrist.score > 0.3) {
              const armAsymmetry = Math.abs(leftWrist.y - rightWrist.y)
              setDetectionMetrics((prev) => ({ ...prev, armAsymmetry }))

              if (armAsymmetry > ARM_DRIFT_THRESHOLD) {
                if (!armDriftStartTimeRef.current) {
                  armDriftStartTimeRef.current = performance.now()
                } else if (performance.now() - armDriftStartTimeRef.current > ARM_DRIFT_DURATION) {
                  triggerSOS('Arms Paralysis')
                }
              } else {
                armDriftStartTimeRef.current = null
              }
            } else {
              armDriftStartTimeRef.current = null
            }
          }

          // 3. Background Task (Fall Detection) Algorithm với Debounce
          const leftShoulder = pts.find((kp) => kp.name === 'left_shoulder')
          const rightShoulder = pts.find((kp) => kp.name === 'right_shoulder')
          const leftAnkle = pts.find((kp) => kp.name === 'left_ankle')
          const rightAnkle = pts.find((kp) => kp.name === 'right_ankle')

          if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
            const avgShoulderY = (leftShoulder.y + rightShoulder.y) / 2
            const currentTime = performance.now()

            if (prevShoulderYRef.current !== null && prevShoulderTimeRef.current !== null) {
              const deltaY = avgShoulderY - prevShoulderYRef.current
              const deltaTime = currentTime - prevShoulderTimeRef.current

              if (deltaTime > 0) {
                const speed = deltaY / deltaTime // pixels per ms
                setDetectionMetrics((prev) => ({ ...prev, fallVelocity: speed * 100 }))
              }
            }
            prevShoulderYRef.current = avgShoulderY
            prevShoulderTimeRef.current = currentTime

            // ── DEBOUNCE Fall Detection: Vai sát Mắt cá chân LIÊN TỤC >=30 frame ──
            // Tránh trigger khi người chỉ cúi xuống nhặt đồ (cúi thường < 30 frames)
            if (leftAnkle && rightAnkle && leftAnkle.score > 0.3 && rightAnkle.score > 0.3) {
              const avgAnkleY = (leftAnkle.y + rightAnkle.y) / 2
              const shoulderAnkleDiff = Math.abs(avgShoulderY - avgAnkleY)

              if (shoulderAnkleDiff < 150) {
                // Vai đang nằm sát mắt cá chân → tăng counter
                fallAnomalyCountRef.current++
              } else {
                // Người đứng thẳng/bình thường → reset counter
                fallAnomalyCountRef.current = 0
              }
              if (fallAnomalyCountRef.current > FALL_DEBOUNCE_THRESHOLD) {
                triggerSOS('Fall Detection')
              }
            } else {
              // Không detect được mắt cá chân → reset
              fallAnomalyCountRef.current = 0
            }
          } else {
            // Không detect được vai → reset
            fallAnomalyCountRef.current = 0
          }
        }
      }

      const now = performance.now()
      const dt = faceLastTimeRef.current ? now - faceLastTimeRef.current : 16
      faceLastTimeRef.current = now

      // ===== Face Landmark Detection (Active in Tab F) =====
      let faceDetected = false
      let asymmetry = 0

      if (activeTab === 'F' && faceDetectorRef.current) {
        const faceLandmarks = await faceDetectorRef.current.estimateFaces(video)

        if (faceLandmarks && faceLandmarks.length > 0) {
          faceDetected = true
          const face = faceLandmarks[0]
          asymmetry = getAsymmetryRatio(face)
          setDetectionMetrics((prev) => ({ ...prev, faceAsymmetry: asymmetry }))

          // Mirror and scale face landmarks drawing
          const facePoints = face.keypoints || face.landmarks
          if (facePoints) {
            ctx.fillStyle = 'rgba(34, 197, 94, 0.4)'
            facePoints.forEach((lm) => {
              const lx = (typeof lm.x === 'number' ? lm.x : lm[0]) * scaleX
              const ly = (typeof lm.y === 'number' ? lm.y : lm[1]) * scaleY
              const drawX = videoSource === 'webcam' ? canvas.width - lx : lx
              ctx.beginPath()
              ctx.arc(drawX, ly, 1.5, 0, 2 * Math.PI)
              ctx.fill()
            })

            // Draw critical facial points
            const noseTip = getKeypoint(face, 4) || getKeypoint(face, 1)
            const leftMouth = getKeypoint(face, 78)
            const rightMouth = getKeypoint(face, 308)

            ctx.fillStyle = '#ec4899'
            ctx.shadowColor = '#db2777'
            ctx.shadowBlur = 6
            ;[noseTip, leftMouth, rightMouth].forEach((pt) => {
              if (pt) {
                const drawX = videoSource === 'webcam' ? canvas.width - pt.x * scaleX : pt.x * scaleX
                ctx.beginPath()
                ctx.arc(drawX, pt.y * scaleY, 5, 0, 2 * Math.PI)
                ctx.fill()
              }
            })
            ctx.shadowBlur = 0 // reset
          }
        }
      }

      // ── DEBOUNCE ACCUMULATOR: Yêu cầu asymmetry > ngưỡng tích lũy ~10 giây ──
      if (activeTab === 'F' && !sosTriggered) {
        if (faceDetected && asymmetry > FACE_TRIGGER_RATIO) {
          faceAccumulatedTimeRef.current += dt
          if (faceAccumulatedTimeRef.current > FACE_ALERT_DURATION) {
            triggerSOS('Face Asymmetry')
            faceAccumulatedTimeRef.current = 0
          }
        } else {
          faceAccumulatedTimeRef.current = Math.max(0, faceAccumulatedTimeRef.current - dt * 2)
        }
      }

      // ===== Speech visual helpers (Active in Tab S) =====
      if (activeTab === 'S') {
        // Simple overlay drawn on canvas
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
        video.onloadedmetadata = () => {
          video.play().catch(e => console.warn('Video file play error:', e))
        }
      }
      clearCanvas()
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

  const resetSOSState = () => {
    setSOSTriggered(false)
    setSOSType(null)
    setEmergencyAdvice('')
    sosReadyRef.current = false
    stopSiren()
    setActiveTab('F')
    faceAccumulatedTimeRef.current = 0
    armDriftStartTimeRef.current = null
    fallAnomalyCountRef.current = 0
    prevShoulderYRef.current = null
    prevShoulderTimeRef.current = null
  }

  const handleStartMonitoring = async () => {
    if (isLoadingModels || !!modelsError) {
      alert('Mô hình AI chưa sẵn sàng.')
      return
    }
    if (videoSource === 'webcam' && (!streamRef.current || !videoRef.current?.srcObject)) {
      await handleStartWebcam()
    } else if (videoSource === 'ipcamera' && !videoRef.current?.src) {
      handleConnectIPCamera()
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

  const getSeverityColor = (value, threshold = 20) => {
    if (value === null || value === undefined) return 'text-slate-400 bg-slate-800/10 border-slate-700/20'
    if (value < threshold * 0.5) return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
    if (value < threshold) return 'text-amber-400 bg-amber-500/10 border-amber-500/20'
    return 'text-rose-500 bg-rose-500/10 border-rose-500/30 animate-pulse'
  }

  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-screen text-slate-100 font-sans">
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6 md:mb-10 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/50 backdrop-blur-sm shadow-lg justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-500/20 p-3 rounded-full">
            <Zap className="text-red-500 w-8 h-8 md:w-10 md:h-10" />
          </div>
          <div>
            <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-orange-400 bg-clip-text text-transparent">
              F.A.S.T Test Sinh Tồn
            </h1>
            <p className="text-xs md:text-sm text-slate-400 font-medium">Quy trình Y khoa phát hiện Đột quỵ sớm</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
        <div className="flex-1 max-w-[800px] w-full flex flex-col gap-4">
          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-md">
            <div className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-950/50 p-2 rounded-xl mb-4">
              <button 
                onClick={() => setVideoSource('webcam')}
                className={`flex-1 min-w-[120px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${
                  videoSource === 'webcam' ? 'bg-blue-600 text-white' : 'bg-transparent text-slate-400'
                }`}
              >
                <Video className="w-4 h-4" /> Webcam
              </button>
              <button 
                onClick={() => setVideoSource('upload')}
                className={`flex-1 min-w-[120px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${
                  videoSource === 'upload' ? 'bg-indigo-600 text-white' : 'bg-transparent text-slate-400'
                }`}
              >
                <Upload className="w-4 h-4" /> File Demo
              </button>
              <button 
                onClick={() => setVideoSource('ipcamera')}
                className={`flex-1 min-w-[120px] py-2.5 flex items-center justify-center gap-2 rounded-lg font-bold text-sm transition-all ${
                  videoSource === 'ipcamera' ? 'bg-teal-600 text-white' : 'bg-transparent text-slate-400'
                }`}
              >
                <Link2 className="w-4 h-4" /> IP Camera
              </button>
            </div>

            {videoSource === 'upload' && (
              <div className="mb-4 bg-indigo-950/20 p-4 rounded-xl border border-indigo-900/30">
                <input type="file" accept="video/mp4,video/webm" onChange={handleFileUpload} className="w-full text-slate-300" />
              </div>
            )}

            {videoSource === 'ipcamera' && (
              <div className="flex flex-col sm:flex-row gap-3 mb-4">
                <input 
                  type="text" 
                  value={ipcameraUrl} 
                  onChange={(e) => setIpcameraUrl(e.target.value)} 
                  placeholder="URL Camera (http://...)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-4 py-3 text-slate-100"
                />
                <button onClick={handleConnectIPCamera} className="bg-teal-600 px-6 py-3 rounded-xl font-bold">Kết nối</button>
              </div>
            )}

            <div className="relative aspect-video bg-black rounded-xl overflow-hidden border border-slate-700/50 shadow-inner">
              <video ref={videoRef} className="hidden" autoPlay playsInline muted={videoSource !== 'upload' || activeTab !== 'S'} width={640} height={480} />
              <canvas ref={canvasRef} width={640} height={480} className="w-full h-full object-contain" />
              {isLoadingModels && (
                <div className="absolute inset-0 bg-slate-900/80 flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-blue-500 rounded-full animate-spin mb-4"></div>
                  <h3 className="text-lg font-bold">Đang tải mô hình AI...</h3>
                </div>
              )}
            </div>

            <div className="mt-4">
              <button
                disabled={isLoadingModels}
                onClick={() => isRunning ? handleStopVideo() : handleStartMonitoring()}
                className={`w-full py-4 rounded-xl font-extrabold text-lg transition-all ${
                  isRunning ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                }`}
              >
                {isRunning ? 'Dừng Phân Tích' : 'Bắt đầu Phân Tích AI'}
              </button>
            </div>
          </div>
        </div>

        <div className="w-full lg:w-[400px] flex flex-col gap-6">
          <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-700/50 shadow-xl flex justify-between gap-1">
            {[
              { id: 'F', step: 'F', label: 'Face' },
              { id: 'A', step: 'A', label: 'Arms' },
              { id: 'S', step: 'S', label: 'Speech' },
              { id: 'T', step: 'T', label: 'SOS' },
            ].map((tab) => (
              <button 
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-3 rounded-xl transition-all ${
                  activeTab === tab.id ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'
                }`}
              >
                <div className="font-black text-xl mb-1">{tab.step}</div>
                <div className="text-[10px] font-bold uppercase">{tab.label}</div>
              </button>
            ))}
          </div>

          <div className="bg-slate-900/80 p-6 rounded-2xl border border-slate-700/50 shadow-xl flex-1 flex flex-col">
            {activeTab === 'F' && (
              <div className="animate-in fade-in">
                <h2 className="text-xl font-bold mb-4">Face (Mặt)</h2>
                <div className={`p-4 rounded-xl border ${getSeverityColor(detectionMetrics?.faceAsymmetry, 8)}`}>
                  <p className="text-sm font-bold">Tỉ lệ bất đối xứng: {(detectionMetrics?.faceAsymmetry || 0).toFixed(1)}%</p>
                </div>
              </div>
            )}
            {activeTab === 'A' && (
              <div className="animate-in fade-in">
                <h2 className="text-xl font-bold mb-4">Arms (Tay)</h2>
                <div className={`p-4 rounded-xl border ${getSeverityColor(detectionMetrics?.armDrift, 100)}`}>
                  <p className="text-sm font-bold">Độ lệch cổ tay: {(detectionMetrics?.armDrift || 0).toFixed(0)} px</p>
                </div>
              </div>
            )}
            {activeTab === 'S' && (
              <div className="animate-in fade-in">
                <h2 className="text-xl font-bold mb-4">Speech (Giọng nói)</h2>
                {videoSource === 'upload' && (
                  <div className="bg-blue-900/40 border border-blue-800 p-3 rounded-xl mb-4 text-sm text-blue-200 leading-relaxed">
                    <span className="font-bold text-amber-400">💡 Lưu ý khi test Video Demo:</span> Công nghệ nhận diện giọng nói (Web Speech API) thu âm thanh từ <b className="text-white">Micro của máy tính</b> chứ không trích xuất âm thanh gốc từ trong file Video. 
                    <br/><br/>
                    Vui lòng <b className="text-white">mở loa ngoài thật lớn</b> để Micro thu lại được tiếng từ video, hoặc bạn hãy <b className="text-white">tự đọc trực tiếp</b> vào máy tính nhé!
                  </div>
                )}
                {speechStatus === 'listening' && (
                  <div className="mb-4 p-3 bg-blue-500/20 border border-blue-500/50 rounded-xl text-blue-300 animate-pulse">
                    🎙️ Đang nghe... Hãy nói: "Bầu trời hôm nay rất xanh"
                  </div>
                )}
                {speechStatus === 'retry' && (
                  <div className="mb-4 p-3 bg-amber-500/20 border border-amber-500/50 rounded-xl text-amber-300">
                    ⚠️ Không nghe rõ hoặc quá thời gian. Vui lòng thử lại.
                  </div>
                )}
                {speechStatus === 'success' && (
                  <div className="mb-4 p-3 bg-emerald-500/20 border border-emerald-500/50 rounded-xl text-emerald-300">
                    ✅ Giọng nói bình thường, rõ ràng.
                  </div>
                )}
                {speechStatus === 'error' && (
                  <div className="mb-4 p-3 bg-rose-500/20 border border-rose-500/50 rounded-xl text-rose-300">
                    🚨 Phát hiện giọng nói bất thường!
                  </div>
                )}

                {speechTranscript && (
                  <div className="mb-4 p-3 bg-slate-800 rounded-xl border border-slate-700">
                    <span className="text-xs text-slate-400">AI nghe được:</span>
                    <p className="text-white font-semibold mt-1">"{speechTranscript}"</p>
                  </div>
                )}

                <button onClick={startSpeechTest} className="w-full py-3 bg-blue-600 hover:bg-blue-500 transition rounded-xl font-bold shadow-lg shadow-blue-900/50">
                  {speechStatus === 'listening' ? 'Đang lắng nghe...' : 'Bắt đầu kiểm tra giọng nói'}
                </button>
              </div>
            )}
            {activeTab === 'T' && (
              <div className="animate-in fade-in">
                <h2 className="text-xl font-bold mb-4">Time (Thời gian & Cấp cứu)</h2>
                {sosTriggered ? (
                  <div className="flex flex-col gap-4">
                    <div className="bg-slate-950 border border-slate-850 p-4 rounded-xl min-h-[150px]">
                      {loadingAdvice ? (
                        <div className="flex flex-col items-center justify-center h-32 gap-3">
                          <RefreshCw className="w-8 h-8 text-rose-500 animate-spin" />
                          <p className="text-sm text-slate-400 font-bold">Đang kết nối Bác sĩ AI để phân tích ảnh cấp cứu...</p>
                        </div>
                      ) : emergencyAdvice ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 border-b border-slate-900 pb-2">
                            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
                            <h4 className="text-sm font-bold text-rose-400 uppercase">3 Bước Sơ Cứu Bác Sĩ AI Tư Vấn:</h4>
                          </div>
                          <p className="text-sm text-slate-200 whitespace-pre-wrap leading-relaxed">
                            {emergencyAdvice}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-32 text-slate-500 text-sm italic">
                          Chưa tải được dữ liệu phân tích từ Gemini.
                        </div>
                      )}
                    </div>

                    {/* Reset Button */}
                    <button
                      id="btn-reset-sos"
                      onClick={resetSOSState}
                      className="w-full mt-4 py-3 bg-slate-800 hover:bg-slate-700 border border-slate-750 text-white font-bold rounded-xl text-sm transition"
                    >
                      🔄 Hủy Báo Động & Đặt Lại Hệ Thống
                    </button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-10 text-slate-500 gap-3">
                    <Clock className="w-12 h-12 opacity-30" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-400">Thời Gian Vàng (Time to Act)</h4>
                      <p className="text-sm text-slate-500 mt-1 max-w-[250px] leading-relaxed mx-auto">
                        Chưa phát hiện dấu hiệu bất thường. Hệ thống đang quét tự động.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
