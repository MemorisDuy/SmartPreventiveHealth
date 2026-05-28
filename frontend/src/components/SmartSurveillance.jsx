import React, { useState, useEffect, useRef } from "react";
import { AlertCircle, X, Play, Pause, RotateCcw } from "lucide-react";
import api from "../api/axios";
import * as tf from '@tensorflow/tfjs-core';
import '@tensorflow/tfjs-backend-webgl';
import '@tensorflow/tfjs-backend-cpu';
import { useSurveillance } from "../context/SurveillanceContext";

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

  // ========== REFS ==========
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const animationIdRef = useRef(null);
  const faceDetectorRef = useRef(null);
  const poseDetectorRef = useRef(null);
  const isAlertingRef = useRef(false);

  // Debounce counters
  const fallCountRef = useRef(0);
  const activeLoopIdRef = useRef(0);
  // Accumulator (Time-based) – chống nhiễu AI, yêu cầu tích lũy 10 giây
  const faceAccumulatedTimeRef = useRef(0);
  const faceLastTimeRef = useRef(performance.now());

  // ========== CONSTANTS (đã hiệu chỉnh dựa trên dữ liệu video y khoa thực tế) ==========
  const ASYMMETRY_THRESHOLD = 0.08; // 8% — y khoa: >5% bất đối xứng cơ mặt là dấu hiệu đột quỵ
  const FACE_ALERT_DURATION = 10000; // Phải duy trì méo miệng liên tục 10 giây (10000ms) mới báo động
  const FALL_DEBOUNCE = 12;         // Cần > 12 frame liên tiếp mới trigger (~0.4 giây)

  // ========== LOAD MODELS (TensorFlow.js) ==========
  useEffect(() => {
    const loadModels = async () => {
      try {
        setIsLoading(true);
        console.log("[LOAD] Tải mô hình TensorFlow.js...");
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
        
        // Load MoveNet model
        const poseModel = poseDetectionModule.SupportedModels.MoveNet;
        const poseDetector = await poseDetectionModule.createDetector(poseModel, {
          modelType: poseDetectionModule.movenet.modelType.SINGLEPOSE_LIGHTNING,
        });
        poseDetectorRef.current = poseDetector;
        console.log("✓ MoveNet Detector Loaded");
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
        if (videoMode === "webcam") {
          videoRef.current.src = "";
          const stream = await navigator.mediaDevices.getUserMedia({
            video: {
              width: { ideal: 640 },
              height: { ideal: 480 },
            },
          });
          videoRef.current.srcObject = stream;
        } else if (videoMode === "demo") {
          videoRef.current.srcObject = null;
          // Check if it already has a blob URL from upload
          if (!videoRef.current.src.startsWith("blob:")) {
            videoRef.current.src = "/demo-video.mp4";
          }
          videoRef.current.loop = true;
        } else if (videoMode === "ip-camera" && ipCameraUrl) {
          videoRef.current.srcObject = null;
          videoRef.current.src = ipCameraUrl;
        }
        
        videoRef.current.onloadedmetadata = () => {
          videoRef.current.play();
          startDetection();
        };
      }
    } catch (error) {
      console.error("[ERROR] Video start failed:", error);
    }
  };

  const stopCamera = () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
      animationIdRef.current = null;
    }
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    if (videoRef.current) {
      videoRef.current.pause();
      // Đừng xóa src nếu đang ở demo (nếu xóa sẽ mất blob URL)
      if (videoMode !== "demo") {
         videoRef.current.src = "";
      }
    }
    if (canvasRef.current) {
      const ctx = canvasRef.current.getContext("2d");
      ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    localStorage.setItem("smart_surveillance_mode", videoMode);
    stopCamera();
    if (videoMode !== "ip-camera" || ipCameraUrl !== "") {
      startVideo();
    }
  }, [videoMode, ipCameraUrl]);

  const handleVideoUpload = (e) => {
    const file = e.target.files?.[0];
    if (file && videoRef.current) {
      videoRef.current.srcObject = null;
      videoRef.current.src = URL.createObjectURL(file);
      videoRef.current.loop = true;
      videoRef.current.play();
      startDetection();
    }
  };

  // ========== DETECTION LOOP ==========
  const startDetection = async () => {
    if (animationIdRef.current) {
      cancelAnimationFrame(animationIdRef.current);
    }
    
    // Increment loop ID to kill any currently sleeping async detect functions
    activeLoopIdRef.current += 1;
    const currentLoopId = activeLoopIdRef.current;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

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
        animationIdRef.current = requestAnimationFrame(detect);
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
      faceLastTimeRef.current = now;
      
      // Giới hạn dt tối đa là 100ms mỗi frame.
      // Giải quyết lỗi: Khi load trang lần đầu tốn nhiều thời gian, dt có thể lên tới 10000ms.
      // Dẫn đến nếu frame đầu tiên có nhiễu (phantom face), nó sẽ cộng dồn đủ 10s và kích hoạt báo động ngay lập tức!
      dt = Math.min(dt, 100);

      // Nếu vượt qua 3 bước trên, video đã an toàn 100% để AI quét
      try {
        const scaleX = canvas.width / video.videoWidth;
        const scaleY = canvas.height / video.videoHeight;

        // Draw video frame
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      if (faceDetectorRef.current && !isAlertingRef.current) {
        try {
          const faces = await faceDetectorRef.current.estimateFaces(canvas);
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

            // Draw landmarks (for debugging)
            ctx.fillStyle = "#00FF00";
            keypoints.forEach((point) => {
              ctx.beginPath();
              ctx.arc(point.x, point.y, 2, 0, 2 * Math.PI);
              ctx.fill();
            });

          }
        } catch (error) {
          console.warn("[WARN] Face detection error:", error);
        }
      }

      // ========== FALL DETECTION (Pose) ==========
      if (poseDetectorRef.current && !isAlertingRef.current) {
        try {
          const poses = await poseDetectorRef.current.estimatePoses(canvas);
          if (activeLoopIdRef.current !== currentLoopId) return; // Kill after await

          if (poses && poses.length > 0) {
            poseDetected = true;
            const keypoints = poses[0].keypoints;

            // Find Shoulder (5 = left shoulder, 6 = right shoulder)
            // Find Ankle (15 = left ankle, 16 = right ankle)
            const leftShoulder = keypoints[5];
            const rightShoulder = keypoints[6];
            const leftAnkle = keypoints[15];
            const rightAnkle = keypoints[16];

            // Check if keypoints are detected with sufficient confidence
            const hasShoulders = leftShoulder && rightShoulder && leftShoulder.score > 0.3 && rightShoulder.score > 0.3;

            let validPointsCount = 0;
            let minX = 10000, maxX = 0, minY = 10000, maxY = 0;
            
            // Draw pose keypoints and calculate bounding box
            ctx.fillStyle = "#FF0000";
            keypoints.forEach((kp) => {
              if (kp.score > 0.3) {
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

            if (hasShoulders && validPointsCount >= 5) {
              shoulderY = (leftShoulder.y + rightShoulder.y) / 2;
              ankleY = maxY; // Dùng điểm thấp nhất để hiển thị UI

              const pWidth = maxX - minX;
              const pHeight = maxY - minY;
              
              let isFallen = false;
              // Fall detection (Cải tiến): 
              // Dựa trên Tỉ lệ khung hình (width > height) để chống nhiễu xa/gần (scale-invariant)
              // Bỏ qua nếu kích thước quá nhỏ (tránh nhiễu bóng ma)
              if (pWidth > 40 && pHeight > 20 && pWidth > pHeight * 1.1) {
                  isFallen = true;
              }

              if (isFallen) {
                  fallCountRef.current += 1;
                  console.log("[DEBUG] Phát hiện ngã. Frame:", fallCountRef.current, " | Tỉ lệ Width/Height:", (pWidth / pHeight).toFixed(2));
                  
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

      // Update stats
      setSurveillanceState((prev) => ({
        ...prev,
        stats: {
          ...prev.stats,
          framesProcessed: prev.stats.framesProcessed + 1,
          faceDetected,
          poseDetected,
          asymmetryRatio: asymmetryRatio.toFixed(3),
          shoulderY: shoulderY.toFixed(0),
          ankleY: ankleY.toFixed(0),
          alertProgress: faceAccumulatedTimeRef.current,
        }
      }));

      // Loop
      animationIdRef.current = requestAnimationFrame(detect);
    };

    detect();
  };

  // ========== ALERTS & ACTIONS ==========
  const triggerAlert = async (type) => {
    if (surveillanceState.alertTriggered) return;
    
    // Capture current frame
    const canvas = canvasRef.current;
    let frameBase64 = null;
    if (canvas) {
      frameBase64 = canvas.toDataURL("image/jpeg");
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

    try {
      // Call emergency API
      const response = await api.post("/api/emergency-alert", {
        image_base64: frameBase64,
        alert_type: type,
      });

      if (response.data) {
        const advice =
          response.data?.emergency_advice ||
          response.data?.advice ||
          "Không nhận được phản hồi. Gọi 115 lập tức!";
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

    // Do NOT stop the camera stream here.
    // Just restart the AI detection loop.
    setTimeout(() => {
      startDetection();
    }, 100);
  };

  // ========== HANDLE MODE CHANGE ==========
  useEffect(() => {
    // Stop current stream
    if (videoRef.current && videoRef.current.srcObject) {
      const tracks = videoRef.current.srcObject.getTracks();
      tracks.forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }

    if (!isAlertingRef.current) {
      setTimeout(() => {
        startVideo();
      }, 500);
    }
  }, [videoMode, ipCameraUrl]);

  // ========== RENDER ==========
  return (
    <div className="p-4 md:p-8 max-w-[1400px] mx-auto min-h-screen text-slate-100 font-sans">
      <div className="flex items-center gap-3 mb-6 md:mb-10 bg-slate-900/60 p-5 rounded-2xl border border-slate-800/50 backdrop-blur-sm shadow-lg">
        <AlertCircle className="text-red-500 w-8 h-8 md:w-10 md:h-10 flex-shrink-0" />
        <div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight bg-gradient-to-r from-red-500 to-rose-400 bg-clip-text text-transparent">
            Giám Sát Y Tế Thông Minh
          </h1>
          <p className="text-xs md:text-sm text-slate-400 mt-1">
            Phát hiện Face Asymmetry (Đột quỵ) & Fall Detection (Té ngã) bằng Edge AI
          </p>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 md:gap-8">
        {/* ========== LEFT AREA: CAMERA & CONTROLS ========== */}
        <div className="flex-1 max-w-[800px] w-full">
          {/* TABS */}
          <div className="flex flex-wrap md:flex-nowrap gap-2 bg-slate-900/80 p-2 rounded-xl border border-slate-700/50 backdrop-blur-md mb-4 shadow-xl">
            <button
              onClick={() => setVideoMode("webcam")}
              className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                videoMode === "webcam"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              📷 Webcam
            </button>
            <button
              onClick={() => setVideoMode("demo")}
              className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                videoMode === "demo"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              📺 Demo Video
            </button>
            <button
              onClick={() => setVideoMode("ip-camera")}
              className={`flex-1 min-w-[120px] py-2.5 rounded-lg text-sm font-semibold transition flex items-center justify-center gap-2 ${
                videoMode === "ip-camera"
                  ? "bg-blue-600 text-white shadow-md shadow-blue-900/20"
                  : "hover:bg-slate-800 text-slate-300"
              }`}
            >
              📡 IP Camera
            </button>
          </div>

          <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700/50 shadow-xl backdrop-blur-md flex flex-col gap-4">
            {/* CONTROL PANEL */}
            {videoMode === "webcam" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={() => triggerAlert("Fall Detection (Test Ngã)")} 
                  className="flex-1 py-3 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition shadow-lg"
                >
                  ⚡ Giả lập Té Ngã (Test)
                </button>
                <button 
                  onClick={stopCamera} 
                  className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-bold transition shadow-lg"
                >
                  ⏹ Tắt Camera
                </button>
              </div>
            )}

            {/* DEMO VIDEO INPUT */}
            {videoMode === "demo" && (
              <div className="flex flex-col sm:flex-row gap-3 mb-2 items-center">
                <input 
                  id="demo-upload-input"
                  type="file" 
                  accept="video/mp4,video/webm" 
                  onChange={(e) => {
                    handleVideoUpload(e);
                    if (e.target.files && e.target.files.length > 0) {
                      setHasCustomVideo(true);
                    } else {
                      setHasCustomVideo(false);
                    }
                  }} 
                  className="flex-1 w-full text-slate-300 file:mr-4 file:py-3 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-indigo-600 file:text-white hover:file:bg-indigo-700 cursor-pointer" 
                />
                {hasCustomVideo && (
                  <button 
                    onClick={() => {
                      if (videoRef.current) {
                        videoRef.current.srcObject = null;
                        videoRef.current.src = "/demo-video.mp4";
                        videoRef.current.loop = true;
                        videoRef.current.play();
                        fallCountRef.current = 0;
                        faceAccumulatedTimeRef.current = 0;
                        setSurveillanceState(prev => ({...prev, stats: {...prev.stats, alertProgress: 0}}));
                        const inputEl = document.getElementById("demo-upload-input");
                        if (inputEl) inputEl.value = "";
                        setHasCustomVideo(false);
                      }
                    }}
                    className="py-3 px-5 bg-slate-700 hover:bg-slate-600 text-white rounded-xl font-bold transition whitespace-nowrap text-sm shadow-lg border border-slate-600"
                  >
                    🗑 Xóa File Test
                  </button>
                )}
              </div>
            )}

            {/* IP CAMERA INPUT */}
            {videoMode === "ip-camera" && (
              <div className="flex flex-col md:flex-row gap-3">
                <input
                  type="text"
                  placeholder="Nhập địa chỉ luồng HTTP/MJPEG..."
                  value={ipCameraUrl}
                  onChange={(e) => setIpCameraUrl(e.target.value)}
                  className="flex-1 p-3 bg-slate-800 border border-slate-700 rounded-xl text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            )}

            {/* VIDEO CONTAINER */}
            <div className="relative bg-black rounded-xl overflow-hidden border border-slate-700/50 shadow-inner">
              <video
                ref={videoRef}
                className="absolute inset-0 w-full h-full object-contain opacity-0 pointer-events-none"
                crossOrigin="anonymous"
                autoPlay
                playsInline
                muted
              />

              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="w-full aspect-video object-contain bg-black"
              />

              {/* Loading overlay */}
              {isLoading && (
                <div className="absolute inset-0 bg-black/80 flex items-center justify-center backdrop-blur-sm">
                  <div className="text-center">
                    <div className="animate-spin w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-blue-400 font-semibold">Đang khởi tạo AI...</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ========== RIGHT AREA: STATS & INFO ========== */}
        <div className="w-full lg:w-[350px] space-y-6">
          {/* STATUS */}
          <div className={`p-5 rounded-2xl border backdrop-blur-md transition-all shadow-xl ${surveillanceState.alertTriggered ? "bg-red-950/40 border-red-500/50" : "bg-slate-900/80 border-slate-700/50"}`}>
            <div className="flex items-center gap-3">
              <div className={`w-3 h-3 rounded-full ${surveillanceState.alertTriggered ? "bg-red-500 animate-pulse" : "bg-emerald-400"}`}></div>
              <span className="font-bold tracking-wide">
                {surveillanceState.alertTriggered ? "🚨 BÁO ĐỘNG" : "✓ Giám sát Bình Thường"}
              </span>
            </div>
          </div>

          {/* STATS PANEL */}
          <div className="bg-slate-900/80 p-5 rounded-2xl border border-slate-700/50 backdrop-blur-md shadow-xl text-sm text-slate-300">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-slate-700/50">
              <span className="text-lg">📊</span>
              <span className="font-bold text-white tracking-wide">Số liệu Real-time</span>
            </div>
            
            <div className="space-y-3">
              <div className="flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg">
                <span className="text-slate-400 font-medium">Khung hình xử lý:</span>
                <span className="font-mono text-blue-400 font-bold">{surveillanceState.stats.framesProcessed}</span>
              </div>
              
              <div className="flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg">
                <span className="text-slate-400 font-medium">Khuôn mặt:</span>
                <span className={`font-bold ${surveillanceState.stats.faceDetected ? "text-emerald-400" : "text-slate-500"}`}>
                  {surveillanceState.stats.faceDetected ? "✓ Phát hiện" : "✗ Không"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg">
                <span className="text-slate-400 font-medium">Dáng người:</span>
                <span className={`font-bold ${surveillanceState.stats.poseDetected ? "text-emerald-400" : "text-slate-500"}`}>
                  {surveillanceState.stats.poseDetected ? "✓ Phát hiện" : "✗ Không"}
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-800/50 px-3 py-2 rounded-lg">
                <span className="text-slate-400 font-medium">Asymmetry Ratio:</span>
                <span className={`font-mono font-bold ${parseFloat(surveillanceState.stats.asymmetryRatio) > ASYMMETRY_THRESHOLD ? "text-rose-500" : "text-amber-500"}`}>
                  {surveillanceState.stats.asymmetryRatio}
                </span>
              </div>
              
              {/* Alert Progress Bar */}
              {((surveillanceState?.stats?.alertProgress || 0) > 0 || parseFloat(surveillanceState?.stats?.asymmetryRatio || 0) > ASYMMETRY_THRESHOLD) && (
                <div className="mt-4 bg-slate-800/80 p-3 rounded-lg border border-rose-900/50 shadow-inner">
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-[11px] text-rose-400 font-bold uppercase tracking-wider">⏱ Cảnh báo Đột quỵ (10s)</span>
                    <span className="text-[11px] font-mono text-rose-300 font-bold">
                      {((surveillanceState?.stats?.alertProgress || 0) / 1000).toFixed(1)}s / 10s
                    </span>
                  </div>
                  <div className="w-full bg-slate-900/80 rounded-full h-3 overflow-hidden border border-slate-700/50">
                    <div 
                      className="bg-gradient-to-r from-orange-500 to-rose-600 h-full rounded-full transition-all duration-100 ease-linear shadow-[0_0_10px_rgba(225,29,72,0.5)]" 
                      style={{ width: `${Math.min(100, ((surveillanceState?.stats?.alertProgress || 0) / 10000) * 100)}%` }}
                    ></div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* INFOGRAPHIC PANEL */}
          <div className="bg-blue-950/40 p-5 rounded-2xl border border-blue-900/50 backdrop-blur-md shadow-xl text-sm">
            <div className="flex gap-2 items-center mb-3">
              <div className="w-6 h-6 rounded-full bg-blue-600 flex items-center justify-center text-white font-bold text-xs">i</div>
              <span className="font-bold text-blue-200">Tiêu chí báo động:</span>
            </div>
            <ul className="list-none space-y-2 text-blue-300/80 leading-relaxed text-xs">
              <li className="flex gap-2"><span className="text-blue-500">•</span> Méo miệng: Độ lệch cơ mặt vượt ngưỡng 8% liên tục trong 10 giây.</li>
              <li className="flex gap-2"><span className="text-blue-500">•</span> Té ngã: Tọa độ vai (Shoulder Y) ngang hàng với mắt cá chân (Ankle Y) liên tục.</li>
              <li className="flex gap-2"><span className="text-blue-500">•</span> Khi kích hoạt, hệ thống sẽ gọi AI Bác Sĩ để cho lời khuyên sơ cứu tức thì.</li>
            </ul>
          </div>
        </div>
      </div>
      
      {/* ========== FULLSCREEN ALERT OVERLAY ========== */}
      {surveillanceState.alertTriggered && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-md p-4">
          <audio autoPlay loop src="https://actions.google.com/sounds/v1/alarms/alarm_clock.ogg" />
          <div className="bg-slate-900 border border-red-500/50 p-6 md:p-10 rounded-3xl max-w-2xl w-full text-center shadow-2xl shadow-red-900/20 max-h-[95vh] overflow-y-auto">
            <AlertCircle className="w-16 h-16 md:w-20 md:h-20 text-red-500 mx-auto mb-4 animate-pulse" />
            <h2 className="text-2xl md:text-4xl font-black text-red-500 mb-2 tracking-tight uppercase">
              Báo Động Khẩn Cấp!
            </h2>
            <h3 className="text-lg md:text-xl text-slate-200 font-bold mb-4">
              Nguyên nhân: <span className="text-red-400 bg-red-950/50 px-3 py-1 rounded-lg">{surveillanceState.alertType}</span>
            </h3>

            {surveillanceState.snapshotUrl && (
              <div className="mb-4 rounded-xl overflow-hidden border border-red-500/30 relative max-h-48 md:max-h-64 flex justify-center bg-black">
                <img src={surveillanceState.snapshotUrl} alt="Alert Snapshot" className="h-full object-contain" />
                <div className="absolute top-2 right-2 bg-red-600/90 text-white text-[10px] uppercase font-bold px-2 py-1 rounded-md shadow-lg">
                  📷 Ảnh Cắt Từ AI
                </div>
              </div>
            )}

            {isWaiting ? (
              <div className="mt-8 flex flex-col items-center justify-center">
                <div className="animate-spin w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full mb-4"></div>
                <p className="text-blue-400 font-medium">Đang lấy lời khuyên y tế từ Bác Sĩ AI...</p>
              </div>
            ) : (
              <div className="mt-8 bg-red-950/30 p-6 rounded-2xl border border-red-900/50 text-left relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1 h-full bg-red-500"></div>
                <h4 className="font-bold text-red-400 mb-3 text-lg flex items-center gap-2">
                  <span className="text-2xl">🚑</span> Hướng Dẫn Sơ Cứu Lập Tức:
                </h4>
                <p className="text-slate-300 whitespace-pre-wrap leading-relaxed text-sm md:text-base">
                  {surveillanceState.emergencyAdvice}
                </p>
              </div>
            )}

            <button
              onClick={resetCamera}
              className="mt-10 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white font-bold py-4 px-10 rounded-xl transition w-full shadow-lg"
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
