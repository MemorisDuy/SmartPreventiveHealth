import React, { createContext, useContext, useState } from 'react';

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
