import React from 'react'
import FASTTestComponent from '../components/FASTTestComponent'

/*
  GHI CHÚ VẤN ĐÁP:
  File này là page wrapper cho FASTTestComponent.
  Vai trò:
  - Route /fast-test sẽ render component FAST chính.
  - Logic AI không nằm ở file này mà nằm trong FASTTestComponent.jsx.
  Khi thầy hỏi code FAST nằm đâu:
  - File này chỉ bọc trang.
  - Phần xử lý Face, Arms, Speech, Time/SOS và Heart Rate nằm ở components/FASTTestComponent.jsx.
*/

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
