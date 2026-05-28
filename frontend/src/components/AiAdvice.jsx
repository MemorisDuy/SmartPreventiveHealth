import React, { useState, useEffect, useRef } from 'react';
import api from '../api/axios';

const SYSTEM_PROMPT =
  'Bạn là một bác sĩ tim mạch giàu kinh nghiệm. Hãy đưa ra chính xác 3 gạch đầu dòng lời khuyên hành động ngắn gọn, thiết thực, ấm áp bằng tiếng Việt dựa vào dữ liệu sức khỏe của bệnh nhân. Không sử dụng markdown in đậm, in nghiêng hoặc ký tự đặc biệt.';

const GROQ_MODEL = 'llama-3.3-70b-versatile';

async function fetchAdviceFromGroq(apiKey, riskPercentage, healthData) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: GROQ_MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Bệnh nhân có mức nguy cơ đột quỵ được máy tính báo là ${riskPercentage}%. Đây là dữ liệu y sinh cụ thể: ${JSON.stringify(healthData)}.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    }),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const msg =
      data?.error?.message ||
      data?.detail ||
      `Groq API lỗi (${response.status})`;
    throw new Error(msg);
  }

  if (data.choices?.[0]?.message?.content) {
    return data.choices[0].message.content;
  }

  throw new Error('Groq không trả về nội dung');
}

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

      const apiKey = import.meta.env.VITE_GROQ_API_KEY;

      try {
        let text = '';

        if (apiKey) {
          try {
            text = await fetchAdviceFromGroq(apiKey, riskPercentage, healthData);
          } catch (clientErr) {
            console.warn('Groq client failed, trying backend:', clientErr.message);
            text = await fetchAdviceFromBackend(riskPercentage, healthData);
          }
        } else {
          text = await fetchAdviceFromBackend(riskPercentage, healthData);
        }

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
