import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

/*
  GHI CHÚ VẤN ĐÁP:
  Component này lấy lời khuyên AI sau khi có kết quả tầm soát.
  Input X: riskPercentage và healthData của người dùng.
  Hàm xử lý f:
  - Ưu tiên gọi backend /api/health-advice để backend dùng Gemini/Groq tạo lời khuyên.
  - Nếu cần, có cơ chế gọi Groq trực tiếp theo cấu hình môi trường.
  Output y: các lời khuyên hành động ngắn gọn, phù hợp với mức nguy cơ và chỉ số sức khỏe.
  Lưu ý:
  - Đây là lời khuyên tham khảo, không phải chẩn đoán thay bác sĩ.
*/

async function fetchAdviceFromBackend(riskPercentage, healthData) {
  const response = await api.post('/api/health-advice', {
    risk_percentage: riskPercentage,
    health_data: healthData,
  });
  return response.data.advice;
}

export default function AiAdvice({ riskPercentage, healthData }) {
  const [advice, setAdvice] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const abortRef = useRef(null);

  const healthDataKey = JSON.stringify(healthData ?? {});

  useEffect(() => {
    if (riskPercentage === undefined || riskPercentage === null) {
      return undefined;
    }

    const controller = new AbortController();
    abortRef.current = controller;

    const loadAdvice = async () => {
      setIsLoading(true);

      try {
        // Luôn gọi qua backend proxy để bảo mật API key và tận dụng auto-fallback (Gemini/OpenRouter/Groq)
        const text = await fetchAdviceFromBackend(riskPercentage, healthData);

        if (!controller.signal.aborted) {
          setAdvice(text);
        }
      } catch (error) {
        console.error('AiAdvice error:', error);
        if (!controller.signal.aborted) {
          const message =
            error.response?.data?.detail ||
            error.message ||
            'Hệ thống bác sĩ AI đang bận, vui lòng thử lại sau.';
          setAdvice(message);
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    loadAdvice();

    return () => {
      controller.abort();
    };
  }, [riskPercentage, healthDataKey]);

  return (
    <div className="mt-6 p-5 bg-white border border-slate-200 rounded-2xl shadow-sm text-left">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl" aria-hidden="true">
          💡
        </span>
        <h3 className="text-lg font-bold text-slate-800">Lời khuyên chi tiết từ Bác sĩ AI</h3>
      </div>
      {isLoading ? (
        <div className="animate-pulse space-y-3" aria-label="Đang tải lời khuyên">
          <div className="h-4 bg-slate-200 rounded w-full"></div>
          <div className="h-4 bg-slate-200 rounded w-5/6"></div>
          <div className="h-4 bg-slate-200 rounded w-4/6"></div>
        </div>
      ) : (
        <div className="text-slate-600 whitespace-pre-line leading-relaxed font-medium">
          {advice}
        </div>
      )}
    </div>
  );
}
