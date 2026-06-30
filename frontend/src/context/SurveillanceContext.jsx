import React, { createContext, useContext, useState } from 'react';

/*
  GHI CHÚ VẤN ĐÁP:
  Context này lưu trạng thái dùng chung cho module giám sát và FAST.
  Input X: các trạng thái sinh ra trong quá trình camera xử lý như alertTriggered,
  alertType, emergencyAdvice và stats.
  Hàm xử lý f: React Context truyền state xuống các component con mà không cần truyền props nhiều tầng.
  Output y: các component khác có thể đọc/cập nhật trạng thái cảnh báo thống nhất.
  Khi thầy hỏi vì sao dùng Context:
  - Vì trạng thái giám sát là dữ liệu dùng chung giữa nhiều component, nên Context giúp quản lý tập trung.
*/

const SurveillanceContext = createContext();

export const useSurveillance = () => useContext(SurveillanceContext);

export const SurveillanceProvider = ({ children }) => {
  // --- Smart Surveillance State ---
  const [surveillanceState, setSurveillanceState] = useState({
    alertTriggered: false,
    alertType: null,
    emergencyAdvice: "",
    stats: {
      framesProcessed: 0,
      faceDetected: false,
      poseDetected: false,
      asymmetryRatio: 0,
      shoulderY: 0,
      ankleY: 0,
    }
  });

  // --- FAST Test State ---
  const [fastTestState, setFastTestState] = useState({
    sosTriggered: false,
    sosType: null,
    emergencyAdvice: "",
    detectionMetrics: {
      faceAsymmetry: null,
      armDrift: null,
    },
    speechStatus: 'idle', // idle, listening, success, error
    speechResult: '',
  });

  const resetSurveillance = () => {
    setSurveillanceState({
      alertTriggered: false,
      alertType: null,
      emergencyAdvice: "",
      stats: {
        framesProcessed: 0,
        faceDetected: false,
        poseDetected: false,
        asymmetryRatio: 0,
        shoulderY: 0,
        ankleY: 0,
      }
    });
  };

  const resetFastTest = () => {
    setFastTestState({
      sosTriggered: false,
      sosType: null,
      emergencyAdvice: "",
      detectionMetrics: {
        faceAsymmetry: null,
        armDrift: null,
      },
      speechStatus: 'idle',
      speechResult: '',
    });
  };

  return (
    <SurveillanceContext.Provider 
      value={{ 
        surveillanceState, setSurveillanceState, resetSurveillance,
        fastTestState, setFastTestState, resetFastTest
      }}
    >
      {children}
    </SurveillanceContext.Provider>
  );
};
