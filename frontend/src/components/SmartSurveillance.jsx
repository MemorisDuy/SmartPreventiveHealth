import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, X, Play, Pause, RotateCcw } from "lucide-react";
import api from "../api/axios";
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { useSurveillance } from "../context/SurveillanceContext";

/*
  GHI CHÚ VẤN ĐÁP:
  Component này là module Giám sát AI bằng webcam, video demo hoặc IP camera.
  Input X: các frame video được lấy liên tục từ nguồn camera/video.
  Hàm xử lý f:
  - TensorFlow.js chạy trên trình duyệt để giảm độ trễ.
  - FaceMesh/landmark dùng để theo dõi bất đối xứng khuôn mặt hoặc méo miệng.
  - MoveNet/pose estimation dùng để theo dõi dáng người và phát hiện té ngã.
  - Khi có cảnh báo, frontend gửi snapshot đến backend /api/emergency-alert.
  Output y: trạng thái giám sát, cảnh báo bất thường và hướng dẫn sơ cứu từ AI.
  Điểm cần nói:
  - Video không gửi liên tục lên server, chỉ gửi ảnh snapshot khi có cảnh báo.
*/

// ============================================================================
// SMART SURVEILLANCE COMPONENT
// Giám sát y tế thông minh với Edge AI (TensorFlow.js) + Cloud AI (Gemini)
// ============================================================================

const SmartSurveillance = () => {
  const { surveillanceState, setSurveillanceState } = useSurveillance();
  const { alertTriggered, alertType, emergencyAdvice, stats } = surveillanceState;

  // ========== STATE ==========
  const [videoMode, setVideoMode] = useState(() => {
    return localStorage.getItem("smart_surveillance_mode") || "webcam";
  }); // "webcam", "demo", "ip-camera"
  const [ipCameraUrl, setIpCameraUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const [hasCustomVideo, setHasCustomVideo] = useState(false);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [customVideoUrl, setCustomVideoUrl] = useState("");

  const [contactEmail, setContactEmail] = useState(() => {
    return localStorage.getItem("surveillance_contact_email") || "";
  });
  const [contactPhone, setContactPhone] = useState(() => {
    return localStorage.getItem("surveillance_contact_phone") || "";
  });
  const [showConfigModal, setShowConfigModal] = useState(() => {
    return !localStorage.getItem("surveillance_contact_email");
  });
  const [emailStatus, setEmailStatus] = useState("");
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testEmailResult, setTestEmailResult] = useState(null);

  // ========== REFS ==========
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const inferenceCanvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const poseDetectorRef = useRef(null);
  const isAlertingRef = useRef(false);
  const lastStatsUpdateRef = useRef(0);

  // Debounce counters
  const fallCountRef = useRef(0);
  const activeLoopIdRef = useRef(0);
  // Accumulator (Time-based) – chống nhiễu AI, yêu cầu tích lũy 10 giây
  const faceAccumulatedTimeRef = useRef(0);
  const faceLastTimeRef = useRef(performance.now());
  const poseHistoryRef = useRef([]); // Lịch sử tọa độ tâm để kiểm tra chuyển động (chống báo động giả phòng trống)
  const isRealPersonRef = useRef(false); // Xác định xem pose này đã từng di chuyển chưa (chứng minh là người thật)
  const consecutiveNoPoseFramesRef = useRef(0); // Đếm số frame liên tiếp không phát hiện pose để reset trạng thái người thật

  // ========== CONSTANTS (đã hiệu chỉnh dựa trên dữ liệu video y khoa thực tế) ==========
  const ASYMMETRY_THRESHOLD = 0.05; // 5% — y khoa: >5% bất đối xứng cơ mặt là dấu hiệu đột quỵ
  const FACE_ALERT_DURATION = 10000; // Phải duy trì méo miệng liên tục 10 giây (10000ms) mới báo động
  const FALL_DEBOUNCE = 12;         // Cần > 12 frame liên tiếp mới trigger (~0.4 giây)

  const AI_INPUT_WIDTH = 320;
  const AI_INPUT_HEIGHT = 240;
  const DETECTION_INTERVAL_MS = 120;

  // Clean up object URL to prevent memory leaks when customVideoUrl changes or unmounts
  useEffect(() => {
    return () => {
      if (customVideoUrl && customVideoUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(customVideoUrl);
          console.log("✓ Revoked blob URL:", customVideoUrl);
        } catch (e) {
          console.warn("[WARN] Failed to revoke blob URL:", e);
        }
      }
    };
  }, [customVideoUrl]);

  // ========== LOAD MODELS (TensorFlow.js) ==========
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        try {
          tf.enableProdMode();
          console.log("✓ TensorFlow.js production mode enabled");
        } catch (prodErr) {
          console.warn("[WARN] Failed to enable TF.js production mode:", prodErr);
        }
        await tf.ready();

        // Tải Face Landmarks Detection
        const faceLandmarksModule = await import(
          "@tensorflow-models/face-landmarks-detection"
        );
        const faceModel = faceLandmarksModule.SupportedModels.MediaPipeFaceMesh;
        const faceDetector = await faceLandmarksModule.createDetector(faceModel, {
          runtime: 'tfjs',
          refineLandmarks: true
        });
        faceDetectorRef.current = faceDetector;
        console.log("✓ Face Landmarks Detector Loaded");

        // Tải Pose Detection (MoveNet)
        const poseDetectionModule = await import(
          "@tensorflow-models/pose-detection"
        );
        
        const poseModel = poseDetectionModule.SupportedModels.MoveNet;
        const poseDetector = await poseDetectionModule.createDetector(poseModel, {
          modelType: poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        poseDetectorRef.current = poseDetector;
        console.log("✓ MoveNet Detector Loaded");

        // --- AI WARMUP (Chống Lag/Đứng Máy ở frame đầu tiên) ---
        console.log("[LOAD] Warming up AI models to compile WebGL shaders...");
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
            console.log("[LOAD] Warmup complete.");
          }
        } catch(e) {
           console.warn('[WARN] Warmup failed:', e);
        }
        // -----------------------------------------------------

      } catch (error) {
        console.error("[ERROR] Model loading failed:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadModels();

    return () => {
      if (animationIdRef.current) {
        cancelAnimationFrame(animationIdRef.current);
      }
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach((track) => track.stop());
        videoRef.current.srcObject = null;
      }
    };
  }, []);

  // ========== START VIDEO ==========
  const startVideo = async () => {
    try {
      if (videoRef.current) {
        // Clear any stale metadata listeners
        videoRef.current.onloadedmetadata = null;

        if (videoMode === "webcam") {
          videoRef.current.src = "";
          videoRef.current.removeAttribute("src");
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
          videoRef.current.srcObject = stream;
        } else if (videoMode === "demo") {
          videoRef.current.srcObject = null;
          const targetSrc = customVideoUrl || "/demo-video.mp4";
          // Only update src if it has actually changed to avoid loop re-render reloading
          if (videoRef.current.src !== window.location.origin + targetSrc && 
              videoRef.current.src !== targetSrc) {
            videoRef.current.src = targetSrc;
          }
          videoRef.current.loop = true;
          videoRef.current.load();
        } else if (videoMode === "ip-camera" && ipCameraUrl) {
          videoRef.current.srcObject = null;
          videoRef.current.src = ipCameraUrl;
          videoRef.current.load();
        }

        const playAndDetect = () => {
          videoRef.current.play()
            .then(() => {
              startDetection();
            })
            .catch((err) => {
              console.error("[ERROR] video.play() failed:", err);
            });
        };

        if (videoRef.current.readyState >= 2) {
          playAndDetect();
        } else {
          videoRef.current.onloadedmetadata = () => {
            playAndDetect();
          };
        }
      }
    } catch (error) {
      console.error("[ERROR] Video start failed:", error);
    }
  };

  const stopCamera = () => {
    // Tăng Loop ID để ngay lập tức huỷ bỏ các vòng lặp AI cũ đang chờ xử lý
    activeLoopIdRef.current += 1;

    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.onloadedmetadata = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      if (videoMode !== "demo") {
         videoRef.current.src = "";
         videoRef.current.removeAttribute("src");
      }
      videoRef.current.load();
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }

    // Reset alert and detection state to prevent UI freeze and busy-loop lags
    isAlertingRef.current = false;
    fallCountRef.current = 0;
    faceAccumulatedTimeRef.current = 0;
    faceLastTimeRef.current = performance.now();
    lastStatsUpdateRef.current = 0;
    poseHistoryRef.current = [];
    isRealPersonRef.current = false;
    consecutiveNoPoseFramesRef.current = 0;
    setEmailStatus("");
    
    setSurveillanceState(prev => ({
      ...prev,
      alertTriggered: false,
      alertType: null,
      emergencyAdvice: "",
      snapshotUrl: null,
      stats: {
          framesProcessed: 0,
          faceDetected: false,
          poseDetected: false,
          asymmetryRatio: 0,
          shoulderY: 0,
          ankleY: 0,
          alertProgress: 0,
      }
    }));

    setIsLoading(false);
  };

  // Tránh tự động kích hoạt camera khi đổi tab chế độ
  useEffect(() => {
    setIsCameraActive(false);
    stopCamera();
  }, [videoMode]);

  useEffect(() => {
    localStorage.setItem("smart_surveillance_mode", videoMode);
    stopCamera();
    if (isCameraActive) {
      if (videoMode !== "ip-camera" || ipCameraUrl !== "") {
        startVideo();
      }
    }
  }, [videoMode, ipCameraUrl, isCameraActive, customVideoUrl]);

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      if (customVideoUrl && customVideoUrl.startsWith("blob:")) {
        URL.revokeObjectURL(customVideoUrl);
      }
      const url = URL.createObjectURL(file);
      setCustomVideoUrl(url);
      setHasCustomVideo(true);
      setIsCameraActive(true);
    }
  };

  // ========== DETECTION LOOP ==========
  const startDetection = async () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    // Reset lịch sử chuyển động
    poseHistoryRef.current = [];
    isRealPersonRef.current = false;
    consecutiveNoPoseFramesRef.current = 0;
    
    // Increment loop ID to kill any currently sleeping async detect functions
    activeLoopIdRef.current += 1;
    const currentLoopId = activeLoopIdRef.current;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    if (!inferenceCanvasRef.current) {
      inferenceCanvasRef.current = document.createElement("canvas");
    }
    const inferenceCanvas = inferenceCanvasRef.current;
    inferenceCanvas.width = AI_INPUT_WIDTH;
    inferenceCanvas.height = AI_INPUT_HEIGHT;
    const inferenceCtx = inferenceCanvas.getContext("2d", { willReadFrequently: false });
    if (!inferenceCtx) return;

    const detect = async () => {
      // KILL SWITCH: If a newer loop was started, stop this one immediately.
      if (activeLoopIdRef.current !== currentLoopId) return;

      const video = videoRef.current;
      
      // 1. Kiểm tra xem thẻ video đã tồn tại chưa
      if (!video) {
          animationIdRef.current = requestAnimationFrame(detect);
          return;
      }

      // 2. Kiểm tra dữ liệu video đã load đủ chưa
      if (video.readyState < 2) {
          animationIdRef.current = requestAnimationFrame(detect);
          return;
      }

      // 3. KIỂM TRA CHÍNH XÁC KÍCH THƯỚC ĐỂ CHỐNG LỖI 0x0
      if (video.videoWidth === 0 || video.videoHeight === 0) {
          animationIdRef.current = requestAnimationFrame(detect);
          return;
      }

      if (isAlertingRef.current) {
        return;
      }

      // Khai báo biến TRƯỚC try để chúng tồn tại ở scope ngoài
      let faceDetected = false;
      let asymmetryRatio = 0;
      let poseDetected = false;
      let shoulderY = 0;
      let ankleY = 0;

      const now = performance.now();
      let dt = now - faceLastTimeRef.current;
      
      // --- Giới hạn FPS quét AI (~15 FPS) để giải phóng CPU/GPU, chống Lag/Treo máy ---
      if (dt < DETECTION_INTERVAL_MS) {
          animationIdRef.current = requestAnimationFrame(detect);
          return;
      }
      
      faceLastTimeRef.current = now;
      
      // Giới hạn dt tối đa là 100ms mỗi frame.
      // Giải quyết lỗi: Khi load trang lần đầu tốn nhiều thời gian, dt có thể lên tới 10000ms.
      // Dẫn đến nếu frame đầu tiên có nhiễu (phantom face), nó sẽ cộng dồn đủ 10s và kích hoạt báo động ngay lập tức!
      dt = Math.min(dt, 100);

      // Nếu vượt qua 3 bước trên, video đã an toàn 100% để AI quét
      try {
        const scaleX = canvas.width / AI_INPUT_WIDTH;
        const scaleY = canvas.height / AI_INPUT_HEIGHT;

        // Let the <video> element render playback smoothly; canvas only draws AI overlays.
        inferenceCtx.drawImage(video, 0, 0, AI_INPUT_WIDTH, AI_INPUT_HEIGHT);
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.setTransform(scaleX, 0, 0, scaleY, 0, 0);

      if (faceDetectorRef.current && !isAlertingRef.current) {
        try {
          const faces = await faceDetectorRef.current.estimateFaces(inferenceCanvas);
          if (activeLoopIdRef.current !== currentLoopId) return; // Kill after await

          if (faces && faces.length > 0) {
            faceDetected = true;
            const keypoints = faces[0].keypoints;

            // 4 for nose tip, 61/78 left mouth, 291/308 right mouth
            const noseTip = keypoints[4] || keypoints[1];
            const leftMouth = keypoints[61] || keypoints[78];
            const rightMouth = keypoints[291] || keypoints[308];

            if (noseTip && leftMouth && rightMouth) {
              // --- Metric 1: Khoảng cách từ mũi đến 2 khóe miệng ---
              const distLeft = Math.hypot(noseTip.x - leftMouth.x, noseTip.y - leftMouth.y);
              const distRight = Math.hypot(noseTip.x - rightMouth.x, noseTip.y - rightMouth.y);
              let distanceRatio = 0;
              if (distLeft > 0 || distRight > 0) {
                const maxDist = Math.max(distLeft, distRight);
                distanceRatio = Math.abs(distLeft - distRight) / maxDist;
              }

              // --- Metric 2: Chênh lệch Y khóe miệng (rũ miệng trực tiếp) ---
              const mouthWidth = Math.hypot(leftMouth.x - rightMouth.x, leftMouth.y - rightMouth.y);
              let droopRatio = 0;
              if (mouthWidth > 5) {
                const mouthYDiff = Math.abs(leftMouth.y - rightMouth.y);
                droopRatio = mouthYDiff / mouthWidth;
              }

              // --- Metric 3: Góc lệch miệng so với đường ngang ---
              let angleRatio = 0;
              const dx = rightMouth.x - leftMouth.x;
              const dy = rightMouth.y - leftMouth.y;
              if (Math.abs(dx) > 5) {
                const angleDeg = Math.abs(Math.atan2(dy, dx) * (180 / Math.PI));
                angleRatio = angleDeg * 2 / 100; // chuyển sang tỉ lệ 0-1
              }

              // Lấy giá trị lớn nhất giữa 3 metrics
              asymmetryRatio = Math.max(distanceRatio, droopRatio, angleRatio);
            }

            // Draw only the key face points needed by the UI.
            ctx.fillStyle = "rgba(0, 255, 0, 0.8)";
            [noseTip, leftMouth, rightMouth].filter(Boolean).forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2.5, 0, 2 * Math.PI);
              ctx.fill();
            });

            // Vẽ các đường nối đo lường bất đối xứng (noseTip, leftMouth, rightMouth)
            if (noseTip && leftMouth && rightMouth) {
              ctx.strokeStyle = "rgba(236, 72, 153, 0.8)"; // Hồng neon
              ctx.lineWidth = 2;
              ctx.shadowColor = "#db2777";
              ctx.shadowBlur = 6;

              // Đường nối khóe miệng trái
              ctx.beginPath();
              ctx.moveTo(noseTip.x, noseTip.y);
              ctx.lineTo(leftMouth.x, leftMouth.y);
              ctx.stroke();

              // Đường nối khóe miệng phải
              ctx.beginPath();
              ctx.moveTo(noseTip.x, noseTip.y);
              ctx.lineTo(rightMouth.x, rightMouth.y);
              ctx.stroke();

              // Đường ngang nối 2 khóe miệng
              ctx.beginPath();
              ctx.moveTo(leftMouth.x, leftMouth.y);
              ctx.lineTo(rightMouth.x, rightMouth.y);
              ctx.stroke();

              // Vẽ 3 điểm mốc màu hồng neon lớn hơn
              ctx.fillStyle = "#ec4899";
              [noseTip, leftMouth, rightMouth].forEach((pt) => {
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, 5.5, 0, 2 * Math.PI);
                ctx.fill();
              });
              ctx.shadowBlur = 0; // reset shadow
            }

          }
        } catch (error) {
          console.warn("[WARN] Face detection error:", error);
        }
      }

      // ========== FALL DETECTION (Pose) ==========
      if (poseDetectorRef.current && !isAlertingRef.current) {
        try {
          const poses = await poseDetectorRef.current.estimatePoses(inferenceCanvas);
          if (activeLoopIdRef.current !== currentLoopId) return; // Kill after await

          if (poses && poses.length > 0) {
            poseDetected = true;
            consecutiveNoPoseFramesRef.current = 0; // Reset bộ đếm mất người
            const keypoints = poses[0].keypoints;

            // Find Shoulder (5 = left shoulder, 6 = right shoulder)
            // Find Ankle (15 = left ankle, 16 = right ankle)
            const leftShoulder = keypoints[5];
            const rightShoulder = keypoints[6];
            const leftHip = keypoints[11];
            const rightHip = keypoints[12];

            // Check if keypoints are detected with sufficient confidence
            const hasShoulder = (leftShoulder && leftShoulder.score > 0.3) || (rightShoulder && rightShoulder.score > 0.3);
            const hasHip = (leftHip && leftHip.score > 0.3) || (rightHip && rightHip.score > 0.3);

            let validPointsCount = 0;
            let minX = 10000, maxX = 0, minY = 10000, maxY = 0;
            
            // Draw pose keypoints and calculate bounding box
            ctx.fillStyle = "#FF0000";
            keypoints.forEach((kp) => {
              if (kp.score > 0.3) { // Giảm ngưỡng từ 0.45 xuống 0.3 để vẽ dáng người chi tiết hơn
                validPointsCount++;
                if (kp.x < minX) minX = kp.x;
                if (kp.x > maxX) maxX = kp.x;
                if (kp.y < minY) minY = kp.y;
                if (kp.y > maxY) maxY = kp.y;

                ctx.beginPath();
                ctx.arc(kp.x, kp.y, 3, 0, 2 * Math.PI);
                ctx.fill();
              }
            });

            // ========== VẼ ĐƯỜNG NỐI KHUNG XƯƠNG (Skeleton Lines) ==========
            const skeletonConnections = [
              [5, 6],   // vai trái - vai phải
              [5, 7],   // vai trái - khuỷu tay trái
              [7, 9],   // khuỷu tay trái - cổ tay trái
              [6, 8],   // vai phải - khuỷu tay phải
              [8, 10],  // khuỷu tay phải - cổ tay phải
              [5, 11],  // vai trái - hông trái
              [6, 12],  // vai phải - hông phải
              [11, 12], // hông trái - hông phải
              [11, 13], // hông trái - đầu gối trái
              [13, 15], // đầu gối trái - mắt cá trái
              [12, 14], // hông phải - đầu gối phải
              [14, 16], // đầu gối phải - mắt cá phải
            ];
            ctx.strokeStyle = "rgba(0, 255, 136, 0.6)";
            ctx.lineWidth = 2;
            skeletonConnections.forEach(([i, j]) => {
              const kpA = keypoints[i];
              const kpB = keypoints[j];
              if (kpA && kpB && kpA.score > 0.3 && kpB.score > 0.3) {
                ctx.beginPath();
                ctx.moveTo(kpA.x, kpA.y);
                ctx.lineTo(kpB.x, kpB.y);
                ctx.stroke();
              }
            });

            // ========== VẼ KHUNG BAO QUANH NGƯỜI (Bounding Box) — LUÔN HIỂN THỊ ==========
            const pWidth = maxX - minX;
            const pHeight = maxY - minY;
            // Tính trước isFallen để xác định màu khung
            const isFallenVisual = (pWidth > 35 && pHeight > 15 && pWidth > pHeight * 1.05);

            if (validPointsCount >= 3 && pWidth > 10 && pHeight > 10) {
              const boxPadding = 12;
              const bx = minX - boxPadding;
              const by = minY - boxPadding;
              const bw = pWidth + boxPadding * 2;
              const bh = pHeight + boxPadding * 2;
              const boxColor = isFallenVisual ? "#FF3333" : "#00FF88";
              const boxGlow = isFallenVisual ? "rgba(255, 51, 51, 0.4)" : "rgba(0, 255, 136, 0.3)";
              const statusText = isFallenVisual ? "⚠ TÉ NGÃ" : "✓ Bình thường";
              const whRatio = pHeight > 0 ? (pWidth / pHeight).toFixed(2) : "N/A";

              // Viền glow phát sáng
              ctx.save();
              ctx.shadowColor = boxGlow;
              ctx.shadowBlur = isFallenVisual ? 16 : 8;
              ctx.strokeStyle = boxColor;
              ctx.lineWidth = isFallenVisual ? 3 : 2;
              ctx.setLineDash(isFallenVisual ? [] : [8, 4]); // Nét liền khi ngã, nét đứt khi bình thường

              // Vẽ hình chữ nhật bo góc
              const cornerRadius = 6;
              ctx.beginPath();
              ctx.moveTo(bx + cornerRadius, by);
              ctx.lineTo(bx + bw - cornerRadius, by);
              ctx.arcTo(bx + bw, by, bx + bw, by + cornerRadius, cornerRadius);
              ctx.lineTo(bx + bw, by + bh - cornerRadius);
              ctx.arcTo(bx + bw, by + bh, bx + bw - cornerRadius, by + bh, cornerRadius);
              ctx.lineTo(bx + cornerRadius, by + bh);
              ctx.arcTo(bx, by + bh, bx, by + bh - cornerRadius, cornerRadius);
              ctx.lineTo(bx, by + cornerRadius);
              ctx.arcTo(bx, by, bx + cornerRadius, by, cornerRadius);
              ctx.closePath();
              ctx.stroke();
              ctx.restore();

              // Nhãn trạng thái ở góc trên trái khung
              const labelText = `${statusText}  W/H: ${whRatio}`;
              ctx.font = "bold 11px Arial, sans-serif";
              const textMetrics = ctx.measureText(labelText);
              const labelW = textMetrics.width + 12;
              const labelH = 18;
              const labelX = bx;
              const labelY = by - labelH - 2;

              // Nền nhãn
              ctx.fillStyle = isFallenVisual ? "rgba(255, 30, 30, 0.85)" : "rgba(0, 180, 100, 0.85)";
              ctx.beginPath();
              ctx.roundRect(labelX, labelY, labelW, labelH, 4);
              ctx.fill();

              // Chữ nhãn
              ctx.fillStyle = "#FFFFFF";
              ctx.font = "bold 11px Arial, sans-serif";
              ctx.fillText(labelText, labelX + 6, labelY + 13);
            }

            // Yêu cầu phát hiện ít nhất 1 vai hoặc 1 hông, và có tối thiểu 5 khớp có độ tin cậy > 0.3
            if ((hasShoulder || hasHip) && validPointsCount >= 5) {
              if (leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3) {
                shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
              } else if (leftShoulder && leftShoulder.score > 0.3) {
                shoulderY = leftShoulder.y;
              } else if (rightShoulder && rightShoulder.score > 0.3) {
                shoulderY = rightShoulder.y;
              }

              ankleY = maxY; // Dùng điểm thấp nhất để hiển thị UI
              
              // 1. Tính toán tọa độ tâm của pose hiện tại
              let sumX = 0, sumY = 0, count = 0;
              if (leftShoulder && leftShoulder.score > 0.3) { sumX += leftShoulder.x; sumY += leftShoulder.y; count++; }
              if (rightShoulder && rightShoulder.score > 0.3) { sumX += rightShoulder.x; sumY += rightShoulder.y; count++; }
              if (leftHip && leftHip.score > 0.3) { sumX += leftHip.x; sumY += leftHip.y; count++; }
              if (rightHip && rightHip.score > 0.3) { sumX += rightHip.x; sumY += rightHip.y; count++; }

              const centerX = count > 0 ? sumX / count : (minX + maxX) / 2;
              const centerY = count > 0 ? sumY / count : (minY + maxY) / 2;

              poseHistoryRef.current.push({ x: centerX, y: centerY });
              if (poseHistoryRef.current.length > 30) {
                poseHistoryRef.current.shift();
              }

              // 2. Kiểm tra xem pose này có di chuyển không
              let isMoving = true;
              let hasRecentMovement = isRealPersonRef.current;
              const poseScore = poses[0].score || 0;

              // Nếu độ tin cậy của toàn bộ dáng người > 0.48, xác nhận ngay là người thật (hỗ trợ nằm im từ đầu)
              if (poseScore > 0.48) {
                isRealPersonRef.current = true;
                hasRecentMovement = true;
              }
              
              if (poseHistoryRef.current.length >= 10) {
                let minPX = 10000, maxPX = 0, minPY = 10000, maxPY = 0;
                poseHistoryRef.current.forEach(p => {
                  if (p.x < minPX) minPX = p.x;
                  if (p.x > maxPX) maxPX = p.x;
                  if (p.y < minPY) minPY = p.y;
                  if (p.y > maxPY) maxPY = p.y;
                });
                const dx = maxPX - minPX;
                const dy = maxPY - minPY;
                const totalMovement = Math.max(dx, dy);
                
                // Nếu độ lệch tâm tối đa trong 10-30 frame gần nhất cực kỳ nhỏ (< 1.2 pixel),
                // nghĩa là khung xương này hoàn toàn tĩnh.
                if (totalMovement < 1.2) {
                  isMoving = false;
                }

                // Nếu trong 30 frame gần nhất có chuyển động > 1.8 pixel, 
                // hoặc độ lệch tâm lớn (đang di chuyển), xác nhận đây là người thật.
                if (totalMovement > 1.8) {
                  isRealPersonRef.current = true;
                  hasRecentMovement = true;
                }
              }

              let isFallen = false;
              if (pWidth > 35 && pHeight > 15 && pWidth > pHeight * 1.05) {
                  isFallen = true;
              }

              // Kích hoạt té ngã nếu nằm ngang (isFallen) và là người thật (đang di chuyển, đã từng di chuyển hoặc có pose score tin cậy)
              if (isFallen && (isMoving || hasRecentMovement || poseScore > 0.48)) {
                  fallCountRef.current += 1;
                  console.log("[DEBUG] Phát hiện ngã. Frame:", fallCountRef.current, " | Tỉ lệ Width/Height:", (pWidth / pHeight).toFixed(2), " | PoseScore:", poseScore.toFixed(2), " | RealPerson:", isRealPersonRef.current);
                  
                  // Đủ số khung hình liên tiếp thì kích hoạt cảnh báo (~10 frame để tránh nhiễu)
                  if (fallCountRef.current > 10) {
                      isAlertingRef.current = true;
                      triggerAlert("Fall Detection (Té ngã)");
                      fallCountRef.current = 0; // Reset
                  }
              } else {
                  // Trừ dần thay vì reset về 0 ngay lập tức để chống nhiễu (Jitter)
                  fallCountRef.current = Math.max(0, fallCountRef.current - 2);
              }
            } else {
              // Reset/giảm dần bộ đếm khi không đủ dữ liệu đáng tin cậy
              fallCountRef.current = Math.max(0, fallCountRef.current - 1);
            }
          } else {
            // Không phát hiện pose trong frame này
            consecutiveNoPoseFramesRef.current += 1;
            // Nếu liên tục mất dấu trong 45 frame (~1.5 giây), reset trạng thái người thật
            if (consecutiveNoPoseFramesRef.current > 45) {
              isRealPersonRef.current = false;
              poseHistoryRef.current = [];
            }
            fallCountRef.current = Math.max(0, fallCountRef.current - 1);
          }
        } catch (error) {
          console.warn("[WARN] Pose detection error:", error);
        }
      }

      } catch (error) {
        console.error("[DEBUG] Lỗi trong lúc AI quét:", error);
      }

      // Xử lý logic 10s bên ngoài try-catch để decay đúng cách khi mất khuôn mặt
      if (!isAlertingRef.current) {
        if (faceDetected && asymmetryRatio > ASYMMETRY_THRESHOLD) {
          faceAccumulatedTimeRef.current += dt;
          if (faceAccumulatedTimeRef.current > FACE_ALERT_DURATION) {
            isAlertingRef.current = true;
            triggerAlert("Face Asymmetry");
            faceAccumulatedTimeRef.current = 0;
          }
        } else {
          // Trừ dần thời gian nếu bình thường, giúp chống nhiễu (jitter)
          faceAccumulatedTimeRef.current = Math.max(0, faceAccumulatedTimeRef.current - dt * 2);
        }
      }

      ctx.setTransform(1, 0, 0, 1, 0, 0);

      // Update stats
      const safeAsymmetryRatio = typeof asymmetryRatio === "number" && !isNaN(asymmetryRatio) ? asymmetryRatio.toFixed(3) : "0.000";
      const safeShoulderY = typeof shoulderY === "number" && !isNaN(shoulderY) ? shoulderY.toFixed(0) : "0";
      const safeAnkleY = typeof ankleY === "number" && !isNaN(ankleY) ? ankleY.toFixed(0) : "0";

      const shouldUpdateStats =
        now - lastStatsUpdateRef.current >= 250 ||
        faceAccumulatedTimeRef.current >= FACE_ALERT_DURATION ||
        isAlertingRef.current;

      if (shouldUpdateStats) {
        lastStatsUpdateRef.current = now;
        setSurveillanceState((prev) => ({
          ...prev,
          stats: {
            ...prev.stats,
            framesProcessed: prev.stats.framesProcessed + 1,
            faceDetected,
            poseDetected,
            asymmetryRatio: safeAsymmetryRatio,
            shoulderY: safeShoulderY,
            ankleY: safeAnkleY,
            alertProgress: faceAccumulatedTimeRef.current,
          }
        }));
      }

      // Loop
      animationIdRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  // ========== ALERTS & ACTIONS ==========
  const triggerAlert = async (type) => {
    if (surveillanceState.alertTriggered) return;
    
    // Capture current frame with both the live video and the AI overlay.
    const canvas = canvasRef.current;
    const video = videoRef.current;
    let frameBase64 = null;
    if (canvas && video && video.videoWidth > 0 && video.videoHeight > 0) {
      const snapshotCanvas = document.createElement("canvas");
      snapshotCanvas.width = canvas.width;
      snapshotCanvas.height = canvas.height;
      const snapshotCtx = snapshotCanvas.getContext("2d");
      if (snapshotCtx) {
        snapshotCtx.drawImage(video, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        snapshotCtx.drawImage(canvas, 0, 0, snapshotCanvas.width, snapshotCanvas.height);
        frameBase64 = snapshotCanvas.toDataURL("image/jpeg", 0.85);
      }
    } else if (canvas) {
      frameBase64 = canvas.toDataURL("image/jpeg", 0.85);
    }

    setSurveillanceState(prev => ({
      ...prev,
      alertTriggered: true,
      alertType: type,
      snapshotUrl: frameBase64
    }));
    setIsWaiting(true);

    console.log(`[ALERT] ${type} detected!`);
    isAlertingRef.current = true;

    // Stop detection loop
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    // Tạm dừng video demo/test để đóng băng hình ảnh tại lúc xảy ra sự cố
    if (videoMode === "demo" && videoRef.current) {
      videoRef.current.pause();
    }

    try {
      // Call emergency API
      const response = await api.post("/api/emergency-alert", {
        image_base64: frameBase64,
        alert_type: type,
        contact_email: contactEmail,
        contact_phone: contactPhone,
      });

      if (response.data) {
        const advice =
          response.data?.emergency_advice ||
          response.data?.advice ||
          "Không nhận được phản hồi. Gọi 115 lập tức!";
        
        if (response.data?.email_sent) {
          setEmailStatus(response.data?.email_message || "Đã tự động gửi email cảnh báo tới người thân!");
        } else {
          setEmailStatus("");
        }

        setSurveillanceState(prev => ({
          ...prev,
          emergencyAdvice: advice
        }));
      } else {
        setSurveillanceState(prev => ({
          ...prev,
          emergencyAdvice: "Lỗi kết nối. Gọi cấp cứu 115!"
        }));
      }
    } catch (error) {
      console.error("[ERROR] API Gọi SOS:", error);
      setSurveillanceState(prev => ({
        ...prev,
        emergencyAdvice: "Lỗi kết nối máy chủ. Gọi ngay 115!"
      }));
    } finally {
      setIsWaiting(false);
    }
  };

  const resetCamera = () => {
    isAlertingRef.current = false;
    setEmailStatus("");
    setSurveillanceState(prev => ({
      ...prev,
      alertTriggered: false,
      alertType: null,
      emergencyAdvice: "",
      snapshotUrl: null,
      stats: {
          framesProcessed: 0,
          faceDetected: false,
          poseDetected: false,
          asymmetryRatio: 0,
          shoulderY: 0,
          ankleY: 0,
          alertProgress: 0,
      }
    }));
    fallCountRef.current = 0;
    faceAccumulatedTimeRef.current = 0;
    faceLastTimeRef.current = performance.now();
    poseHistoryRef.current = []; // Reset lịch sử tọa độ tâm
    isRealPersonRef.current = false;
    consecutiveNoPoseFramesRef.current = 0;

    // Reset video demo về đầu và chạy lại
    if (videoMode === "demo" && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current.play().catch((err) => console.warn("[WARN] Video play failed on reset:", err));
    }

    // Do NOT stop the camera stream here.
    // Just restart the AI detection loop.
    setTimeout(() => {
      startDetection();
    }, 100);
  };

  // ========== RENDER ==========
  if (showConfigModal) {
    return (
      <div className="p-3 sm:p-6 md:p-8 max-w-[550px] mx-auto min-h-[80vh] flex flex-col justify-center text-left">
        <div className="bg-white/90 backdrop-blur-md p-6 sm:p-8 rounded-3xl border border-slate-200/80 shadow-2xl flex flex-col gap-5">
          <div className="text-center">
            <div className="w-16 h-16 rounded-2xl bg-rose-50 border border-rose-100 flex items-center justify-center mb-4 mx-auto text-rose-500 shadow-sm">
              <AlertCircle size={32} />
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">
              Cài Đặt Cảnh Báo Khẩn Cấp
            </h1>
            <p className="text-xs text-slate-500 mt-2 leading-relaxed">
              Vui lòng cung cấp email của người thân hoặc người giám hộ. Khi phát hiện té ngã hoặc dấu hiệu đột quỵ qua camera AI, hệ thống sẽ lập tức gửi email thông báo kèm hình ảnh sự cố.
            </p>
          </div>

          {/* AI Model Info */}
          <div className="rounded-2xl bg-slate-50 border border-slate-200 p-4 space-y-2">
            <p className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wider mb-2">🤖 Mô hình AI sử dụng</p>
            <p className="text-[11px] text-slate-500 italic">🤖 <strong>MediaPipe FaceMesh</strong> (468 điểm mốc) — phát hiện méo miệng/bất đối xứng cơ mặt, chạy trên trình duyệt, không cần GPU.</p>
            <p className="text-[11px] text-slate-500 italic">🤖 <strong>MediaPipe Pose</strong> (33 khớp xương) — theo dõi tư thế toàn thân, phát hiện té ngã theo thời gian thực.</p>
            <p className="text-[11px] text-slate-500 italic">✨ <strong>Google Gemini 2.0 Flash</strong> — phân tích hình ảnh sự cố & đưa ra hướng dẫn sơ cứu y tế tức thì.</p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              const emailVal = e.target.email.value.trim();
              const phoneVal = e.target.phone.value.trim();
              if (!emailVal || !emailVal.includes("@")) {
                alert("Vui lòng nhập địa chỉ email hợp lệ!");
                return;
              }
              localStorage.setItem("surveillance_contact_email", emailVal);
              localStorage.setItem("surveillance_contact_phone", phoneVal);
              setContactEmail(emailVal);
              setContactPhone(phoneVal);
              setShowConfigModal(false);
            }}
            className="space-y-4"
          >
            <div>
              <label htmlFor="config-email" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                📧 Gmail nhận cảnh báo (Bắt buộc):
              </label>
              <input
                id="config-email"
                name="email"
                type="email"
                defaultValue={contactEmail}
                placeholder="VD: nguoi-than@gmail.com"
                required
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            <div>
              <label htmlFor="config-phone" className="block text-xs font-extrabold text-slate-700 uppercase tracking-wider mb-2">
                📞 Số điện thoại người nhận (Tùy chọn):
              </label>
              <input
                id="config-phone"
                name="phone"
                type="tel"
                defaultValue={contactPhone}
                placeholder="VD: 0912345678"
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 focus:border-rose-500 focus:bg-white rounded-xl text-sm font-medium outline-none transition-all placeholder:text-slate-400"
              />
            </div>

            {testEmailResult && (
              <div className={`p-3 rounded-xl text-xs font-semibold border ${
                testEmailResult.loading 
                  ? "bg-blue-50 text-blue-700 border-blue-200 animate-pulse" 
                  : testEmailResult.success 
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200" 
                    : "bg-red-50 text-red-700 border-red-200"
              }`}>
                {testEmailResult.message}
              </div>
            )}

            <div className="flex gap-3 mt-2">
              <button
                type="submit"
                className="flex-1 py-3.5 bg-rose-600 hover:bg-rose-700 active:scale-[0.98] text-white font-extrabold text-sm rounded-xl shadow-lg shadow-rose-200/40 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                🚀 Lưu & Vào Giám Sát
              </button>

              <button
                type="button"
                disabled={isTestingEmail}
                onClick={async () => {
                  const emailInput = document.getElementById("config-email");
                  const emailVal = emailInput ? emailInput.value.trim() : "";
                  if (!emailVal || !emailVal.includes("@")) {
                    alert("Vui lòng nhập địa chỉ email hợp lệ để test!");
                    return;
                  }
                  
                  setIsTestingEmail(true);
                  setTestEmailResult({ loading: true, message: "Đang tiến hành gửi email thử nghiệm..." });
                  try {
                    const res = await api.post("/api/test-email", { receiver_email: emailVal });
                    if (res.data?.success) {
                      setTestEmailResult({ success: true, message: res.data.message });
                    } else {
                      setTestEmailResult({ success: false, message: res.data.message || "Gửi email thử nghiệm thất bại." });
                    }
                  } catch (err) {
                    console.error("[TEST-EMAIL] Error:", err);
                    setTestEmailResult({ success: false, message: "Lỗi kết nối server khi gửi thử nghiệm." });
                  } finally {
                    setIsTestingEmail(false);
                  }
                }}
                className="px-4 py-3.5 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-extrabold text-sm rounded-xl border border-slate-200 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {isTestingEmail ? "⏳ Đang gửi..." : "🧪 Test Gửi Mail"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-6 md:p-8 max-w-[1400px] mx-auto min-h-screen text-slate-800 font-sans selection:bg-rose-500/10 selection:text-slate-900">
      {/* CSS Injected Styles for Micro-animations */}
      <style>{`
        @keyframes custom-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.5; transform: scale(0.98); }
        }
        .hud-pulse-glow {
          animation: custom-pulse 2s infinite ease-in-out;
        }
      `}</style>

      {/* Header Banner - High Tech Medical HUD */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-6 md:mb-8 bg-white/60 backdrop-blur-md p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-md justify-between">
        <div className="flex items-center gap-4">
          <div className="bg-red-50 p-3 rounded-2xl border border-red-100 flex items-center justify-center">
            <AlertCircle className="text-red-500 w-8 h-8 md:w-9 md:h-9" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight bg-gradient-to-r from-red-650 via-orange-500 to-amber-500 bg-clip-text text-transparent">
              Giám Sát Y Tế Thông Minh
            </h1>
            <p className="text-[11px] sm:text-xs text-slate-500 font-bold uppercase tracking-wider mt-0.5">
              Phát hiện Face Asymmetry (Đột quỵ) & Fall Detection (Té ngã) bằng Edge AI
            </p>
          </div>
        </div>

        {/* Live Status Badge & Settings */}
        <div className="flex flex-wrap items-center gap-3 justify-center md:justify-end">
          {contactEmail && (
            <div className="text-right hidden sm:block">
              <span className="text-[9px] text-slate-400 block font-bold uppercase tracking-wider">Cảnh báo gửi tới:</span>
              <span className="text-xs text-slate-700 font-black">{contactEmail}</span>
            </div>
          )}
          
          <button
            onClick={() => {
              setTestEmailResult(null);
              setShowConfigModal(true);
            }}
            className="px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-slate-800 transition-all cursor-pointer shadow-sm text-xs font-extrabold flex items-center gap-1.5 active:scale-95"
            title="Sửa thông tin liên hệ khẩn cấp"
          >
            ⚙️ Cài đặt
          </button>

          <div className="flex-shrink-0">
            {surveillanceState.alertTriggered ? (
              <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-red-50 border border-red-200 text-red-600 font-extrabold text-xs uppercase tracking-wider animate-pulse">
                <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
                🚨 BÁO ĐỘNG KHẨN CẤP
              </div>
          ) : isLoading ? (
            <div className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-600 font-bold text-xs uppercase tracking-wider animate-pulse">
              <span className="w-2 h-2 rounded-full bg-amber-500"></span>
              Đang tải mô hình AI
            </div>
          ) : isCameraActive ? (
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

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
        {/* ========== LEFT AREA: CAMERA & CONTROLS ========== */}
        <div className="flex-1 max-w-[800px] w-full flex flex-col gap-4">
          {/* TABS */}
          <div className="flex flex-wrap sm:flex-nowrap gap-2 bg-slate-100 p-1.5 rounded-xl border border-slate-200/50 mb-4 shadow-sm">
            <button
              onClick={() => setVideoMode("webcam")}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                videoMode === "webcam"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              📷 Webcam
            </button>
            <button
              onClick={() => setVideoMode("demo")}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                videoMode === "demo"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              📺 Demo Video
            </button>
            <button
              onClick={() => setVideoMode("ip-camera")}
              className={`flex-1 min-w-[100px] py-2.5 rounded-lg text-xs sm:text-sm font-extrabold transition-all flex items-center justify-center gap-2 cursor-pointer ${
                videoMode === "ip-camera"
                  ? "bg-blue-600 text-white shadow-sm hover:bg-blue-700"
                  : "bg-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              📡 IP Camera
            </button>
          </div>

          <div className="bg-white/60 p-4 sm:p-5 rounded-2xl border border-slate-200/80 shadow-md backdrop-blur-md flex flex-col gap-4">
            {/* CONTROL PANEL */}
            {videoMode === "webcam" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => triggerAlert("Fall Detection (Test Ngã)")} 
                  disabled={!isCameraActive}
                  className={`flex-1 py-3 rounded-xl font-bold transition shadow-lg ${
                    isCameraActive 
                      ? "bg-amber-500 hover:bg-amber-600 text-white shadow-md shadow-amber-250/20" 
                      : "bg-slate-100 text-slate-400 border border-slate-200/80 cursor-not-allowed"
                  }`}
                >
                  ⚡ Giả lập Té Ngã (Test)
                </button>
                {isCameraActive ? (
                  <button 
                    onClick={() => setIsCameraActive(false)} 
                    className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-lg cursor-pointer"
                  >
                    ⏹ Tắt Camera
                  </button>
                ) : (
                  <button 
                    onClick={() => setIsCameraActive(true)} 
                    className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition shadow-lg cursor-pointer"
                  >
                    ▶ Bật Camera
                  </button>
                )}
              </div>
            )}

            {/* DEMO VIDEO INPUT */}
            {videoMode === "demo" && (
              <div className="flex flex-col sm:flex-row gap-3 mb-2 items-center">
                <input 
                  id="demo-upload-input"
                  type="file" 
                  accept="video/mp4,video/webm" 
                  onChange={handleVideoUpload} 
                  className="flex-1 w-full text-xs text-slate-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-extrabold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" 
                />
                {isCameraActive ? (
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(false)}
                    className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg shrink-0 cursor-pointer"
                  >
                    ⏹ Tắt Video
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    className="py-3 px-5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg shrink-0 cursor-pointer"
                  >
                    ▶ Phát Video
                  </button>
                )}
                {hasCustomVideo && (
                  <button 
                    onClick={() => {
                      setCustomVideoUrl("");
                      setHasCustomVideo(false);
                      setIsCameraActive(false);
                      
                      if (videoRef.current) {
                        videoRef.current.srcObject = null;
                        videoRef.current.src = "/demo-video.mp4";
                        videoRef.current.loop = true;
                      }
                      
                      fallCountRef.current = 0;
                      faceAccumulatedTimeRef.current = 0;
                      setSurveillanceState(prev => ({
                        ...prev,
                        stats: {
                          ...prev.stats,
                          alertProgress: 0
                        }
                      }));

                      const inputEl = document.getElementById("demo-upload-input");
                      if (inputEl) {
                        inputEl.value = "";
                      }
                    }}
                    className="py-3 px-5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg border border-slate-600 cursor-pointer"
                  >
                    🗑 Xóa File Test
                  </button>
                )}
              </div>
            )}

            {/* IP CAMERA INPUT */}
            {videoMode === "ip-camera" && (
              <div className="flex flex-col gap-3">
                <div className="flex flex-col sm:flex-row gap-3">
                  <input
                    type="text"
                    placeholder="Nhập địa chỉ luồng HTTP/MJPEG..."
                    value={ipCameraUrl}
                    onChange={(e) => setIpCameraUrl(e.target.value)}
                    className="flex-1 bg-slate-50 border border-slate-200 rounded-xl px-4 py-2.5 text-slate-800 text-xs sm:text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all placeholder:text-slate-400"
                  />
                  {isCameraActive ? (
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(false)}
                      className="py-3 px-5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg shrink-0 cursor-pointer"
                    >
                      ⏹ Ngắt kết nối
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setIsCameraActive(true)}
                      disabled={!ipCameraUrl}
                      className={`py-3 px-5 rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg shrink-0 cursor-pointer ${
                        ipCameraUrl 
                          ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-200/30" 
                          : "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                      }`}
                    >
                      ▶ Kết nối IP
                    </button>
                  )}
                </div>
                <div className="flex items-start gap-2 bg-blue-50/70 p-3 rounded-lg border border-blue-100 text-[11px] text-blue-800 leading-relaxed">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-blue-600" />
                  <div>
                    <span className="font-extrabold block mb-0.5 text-blue-800">⚠️ Hướng dẫn kỹ thuật:</span>
                    Trình duyệt không hỗ trợ trực tiếp giao thức camera thô như <code>rtsp://</code>. Hãy chuyển đổi luồng camera thành <strong>HLS (.m3u8)</strong>, <strong>WebRTC</strong> hoặc sử dụng proxy video hỗ trợ.
                  </div>
                </div>
              </div>
            )}

            {/* VIDEO CONTAINER */}
            <div className="relative aspect-video bg-slate-950 rounded-2xl overflow-hidden border border-slate-200 shadow-md group">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain"
                crossOrigin="anonymous"
                autoPlay
                playsInline
                muted
              />

              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="absolute inset-0 w-full h-full object-contain pointer-events-none"
              />

              {/* HUD Frame decoration overlay */}
              <div className="absolute inset-0 pointer-events-none z-10">
                {/* 4 Corners brackets */}
                <div className="absolute top-4 left-4 w-6 h-6 border-t-2 border-l-2 border-cyan-400/80 rounded-tl-sm transition-all group-hover:scale-105" />
                <div className="absolute top-4 right-4 w-6 h-6 border-t-2 border-r-2 border-cyan-400/80 rounded-tr-sm transition-all group-hover:scale-105" />
                <div className="absolute bottom-4 left-4 w-6 h-6 border-b-2 border-l-2 border-cyan-400/80 rounded-bl-sm transition-all group-hover:scale-105" />
                <div className="absolute bottom-4 right-4 w-6 h-6 border-b-2 border-r-2 border-cyan-400/80 rounded-br-sm transition-all group-hover:scale-105" />

                {/* Model ready pill status badges */}
                {!isLoading && isCameraActive && (
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
              {!isCameraActive && (
                <div className="absolute inset-0 bg-slate-50/98 flex flex-col items-center justify-center p-6 text-center backdrop-blur-sm z-10 border border-slate-200 rounded-2xl">
                  <div className="w-16 h-16 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center mb-4 text-slate-400 shadow-sm">
                    <AlertCircle size={28} className="text-slate-400 animate-pulse" />
                  </div>
                  <h3 className="font-extrabold text-slate-700 text-sm sm:text-base mb-2">
                    {videoMode === "webcam" && "Thiết bị giám sát đang tắt"}
                    {videoMode === "demo" && "Video chạy thử đang tắt"}
                    {videoMode === "ip-camera" && "Luồng IP Camera đang tắt"}
                  </h3>
                  <p className="text-xs text-slate-500 max-w-sm mb-6 leading-relaxed">
                    {videoMode === "webcam" && "Hệ thống chưa khởi động camera. Nhấn nút bên dưới hoặc nút 'Bật Camera' để bắt đầu phân tích AI thời gian thực."}
                    {videoMode === "demo" && "Nhấn nút bên dưới hoặc nút 'Phát Video' để chạy video demo và bắt đầu giám sát giả lập AI."}
                    {videoMode === "ip-camera" && "Nhấn nút bên dưới hoặc nút 'Kết nối IP' để liên kết và bắt đầu giám sát luồng video từ mạng IP."}
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsCameraActive(true)}
                    disabled={videoMode === "ip-camera" && !ipCameraUrl}
                    className={`px-8 py-3 rounded-xl text-xs sm:text-sm font-extrabold transition-all shadow-md flex items-center gap-2 hover:scale-[1.02] active:scale-95 duration-200 cursor-pointer ${
                      videoMode === "ip-camera" && !ipCameraUrl
                        ? "bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200/30"
                    }`}
                  >
                    {videoMode === "webcam" && "Bật Camera"}
                    {videoMode === "demo" && "Phát Video Demo"}
                    {videoMode === "ip-camera" && "Bật Kết nối IP"}
                  </button>
                </div>
              )}

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-slate-50/98 backdrop-blur-sm flex flex-col items-center justify-center z-20">
                  <div className="w-12 h-12 border-4 border-t-blue-500 border-r-transparent border-slate-200 rounded-full animate-spin mb-4"></div>
                  <h3 className="text-base font-extrabold text-slate-700 tracking-wide">Đang khởi động Mô hình AI...</h3>
                  <p className="text-xs text-slate-500 mt-1">Quá trình này chỉ diễn ra ở lần chạy đầu tiên</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT AREA: STATS & INFO ========== */}
        <div className="w-full lg:w-[350px] space-y-6 flex flex-col gap-1">
          {/* STATUS */}
          <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all shadow-md ${
            surveillanceState.alertTriggered 
              ? "bg-red-50 border-red-200 text-red-800 animate-pulse animate-duration-1000" 
              : "bg-white/80 border-slate-200/80 text-slate-800"
          }`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${surveillanceState.alertTriggered ? "bg-red-500 animate-pulse" : "bg-emerald-500"}`}></div>
              <span className="font-extrabold tracking-wide text-xs uppercase">
                {surveillanceState.alertTriggered ? "🚨 Trạng thái: BÁO ĐỘNG" : "✓ Trạng thái: Giám sát Bình Thường"}
              </span>
            </div>
          </div>

          {/* STATS PANEL */}
          <div className="bg-white/80 p-5 rounded-2xl border border-slate-200/80 backdrop-blur-md shadow-md text-sm text-slate-600">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-200/80">
              <span className="text-lg">📊</span>
              <span className="font-bold text-slate-800 tracking-wide">Số liệu Real-time</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-bold text-xs uppercase">Khung hình xử lý:</span>
                <span className="font-mono text-blue-600 font-bold text-sm">{surveillanceState.stats.framesProcessed}</span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-bold text-xs uppercase">Khuôn mặt:</span>
                <span className={`font-bold text-xs ${surveillanceState.stats.faceDetected ? "text-emerald-600" : "text-slate-400"}`}>
                  {surveillanceState.stats.faceDetected ? "✓ Phát hiện" : "✗ Không"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-bold text-xs uppercase">Dáng người:</span>
                <span className={`font-bold text-xs ${surveillanceState.stats.poseDetected ? "text-emerald-600" : "text-slate-400"}`}>
                  {surveillanceState.stats.poseDetected ? "✓ Phát hiện" : "✗ Không"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50 px-3 py-2.5 rounded-lg border border-slate-100">
                <span className="text-slate-500 font-bold text-xs uppercase">Asymmetry Ratio:</span>
                <span className={`font-mono font-bold text-sm ${parseFloat(surveillanceState.stats.asymmetryRatio) >= ASYMMETRY_THRESHOLD ? "text-rose-600 animate-pulse font-black" : "text-emerald-600"}`}>
                  {(parseFloat(surveillanceState.stats.asymmetryRatio) * 100).toFixed(1)}%
                </span>
              </div>
              
              {/* Alert Progress Bar */}
              {((surveillanceState?.stats?.alertProgress || 0) > 0 || parseFloat(surveillanceState?.stats?.asymmetryRatio || 0) >= ASYMMETRY_THRESHOLD) && (
                <div className="mt-4 bg-rose-50/70 p-3.5 rounded-xl border border-rose-100 shadow-inner animate-pulse">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[10px] text-rose-700 font-black uppercase tracking-wider">⏱ Cảnh báo Đột quỵ (10s)</span>
                    <span className="text-[10px] font-mono text-rose-600 font-black">
                      {((surveillanceState?.stats?.alertProgress || 0) / 1000).toFixed(1)}s / 10s
                    </span>
                  </div>
                  <div className="w-full bg-slate-200/60 rounded-full h-3 overflow-hidden border border-rose-200/30">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-rose-600 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_8px_rgba(225,29,72,0.3)]" 
                      style={{ width: `${Math.min(100, ((surveillanceState?.stats?.alertProgress || 0) / 10000) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* INFOGRAPHIC PANEL */}
          <div className="bg-blue-50/50 p-5 rounded-2xl border border-blue-100 backdrop-blur-md shadow-sm text-sm">
            <div className="flex gap-2 items-center mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">i</div>
              <span className="font-extrabold text-blue-800 text-xs uppercase tracking-wide">Tiêu chí báo động:</span>
            </div>
            <ul className="list-none space-y-2 text-slate-600 leading-relaxed text-xs">
              <li className="flex gap-2"><span className="text-blue-500">•</span> <strong>Méo miệng:</strong> Độ lệch cơ mặt vượt ngưỡng 8% liên tục trong 10 giây.</li>
              <li className="flex gap-2"><span className="text-blue-500">•</span> <strong>Té ngã:</strong> Vai sát mắt cá chân và chiều rộng khung xương rộng hơn chiều cao cơ thể liên tục.</li>
              <li className="flex gap-2"><span className="text-blue-500">•</span> Khi kích hoạt báo động, hệ thống sẽ tự động gọi Cloud AI để nhận diện sơ cứu.</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* ========== FULLSCREEN ALERT OVERLAY ========== */}
      {surveillanceState.alertTriggered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <audio autoPlay loop src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" />
          <div className="bg-white border border-slate-150 p-4 sm:p-5 rounded-2xl max-w-md w-full text-center shadow-xl shadow-red-200/20 max-h-[92vh] overflow-y-auto">
            {/* compact unified header */}
            <div className="flex items-center gap-3 justify-center mb-3 bg-red-50 border border-red-150/70 p-2.5 rounded-xl">
              <AlertCircle className="w-6.5 h-6.5 text-red-600 animate-bounce" />
              <div className="text-left">
                <h2 className="text-base font-black text-red-600 tracking-tight uppercase leading-none">
                  BÁO ĐỘNG KHẨN CẤP
                </h2>
                <div className="text-[10px] text-slate-500 font-bold uppercase mt-1">
                  Nguyên nhân: <span className="text-red-700 font-extrabold">{surveillanceState.alertType}</span>
                </div>
              </div>
            </div>

            {surveillanceState.snapshotUrl && (
              <div className="mb-3 rounded-xl overflow-hidden border border-slate-200 relative h-28 sm:h-32 flex justify-center bg-slate-950 shadow-sm">
                <img src={surveillanceState.snapshotUrl} alt="Alert Snapshot" className="h-full object-contain" />
                <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[8px] uppercase font-bold px-1.5 py-0.5 rounded shadow-md">
                  📷 Ảnh Cắt Từ AI
                </div>
              </div>
            )}

            {emailStatus && (
              <div className="mb-3 p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-left text-[11px] leading-relaxed flex items-start gap-2 shadow-inner">
                <span className="text-base flex-shrink-0">📧</span>
                <div>
                  <strong className="text-emerald-900 block mb-0.5 font-bold">Email Cảnh Báo SOS:</strong>
                  {emailStatus}
                </div>
              </div>
            )}

            {isWaiting ? (
              <div className="my-3 flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200/60 shadow-inner">
                <div className="animate-spin w-6 h-6 border-3 border-blue-600 border-t-transparent rounded-full mb-2"></div>
                <p className="text-blue-600 text-[11px] font-extrabold">Đang kết nối Bác Sĩ AI lấy lời khuyên y tế...</p>
              </div>
            ) : (
              <div className="my-3 bg-slate-50 p-3 rounded-xl border border-slate-200/60 text-left relative overflow-hidden shadow-inner">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 className="font-bold text-red-700 mb-1 text-xs flex items-center gap-1.5">
                  <span>🚑</span> Hướng Dẫn Sơ Cứu Lập Tức (Bác Sĩ AI):
                </h4>
                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed text-[11px] max-h-32 overflow-y-auto pr-1">
                  {surveillanceState.emergencyAdvice}
                </p>
              </div>
            )}

            <button
              onClick={resetCamera}
              className="mt-4 bg-slate-800 hover:bg-slate-900 text-white font-extrabold py-2.5 px-4 rounded-xl transition w-full shadow-md hover:scale-[1.01] active:scale-95 duration-200 cursor-pointer text-xs uppercase tracking-wider"
            >
              Đóng Cảnh Báo & Khôi Phục Hệ Thống
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default SmartSurveillance;
