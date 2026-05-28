import React from 'react'
import FASTTestComponent from '../components/FASTTestComponent'

/**
 * FastTestPage - Wrapper cho FAST Test Component
 * 
 * F.A.S.T = Face, Arms, Speech, Time
 * Phát hiện dấu hiệu đột quỵ bằng Computer Vision + AI
 * - Face: FaceMesh để detect méo miệng (asymmetry > 20%)
 * - Arms: MoveNet để detect liệt tay (wrist Y difference > 100px trong 2s)
 * - Speech: Speech Recognition để detect rối loạn ngôn ngữ
 * - Background: MoveNet để detect té ngã (shoulder/ankle distance < 50px)
 * 
 * Khi SOS kích hoạt:
 * - Capture canvas to base64
 * - Call /api/emergency-alert
 * - Get Gemini Vision advice
 * - Display emergency instructions
 */
export default function FastTestPage() {
  return <FASTTestComponent />
}
