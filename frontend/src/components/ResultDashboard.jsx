import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import XAIChart from './XAIChart';
import AiAdvice from './AiAdvice';
import { formatHealthDataForAi, getRiskTier } from '../data/healthFormLabels';

/*
  GHI CHÚ VẤN ĐÁP:
  Component này hiển thị kết quả sau khi tầm soát nguy cơ.
  Input X: result từ backend và healthDataRaw từ form người dùng.
  Hàm xử lý f:
  - Tính nhóm nguy cơ để đổi màu/giao diện.
  - Format dữ liệu sức khỏe sang tiếng Việt để hiển thị và gửi cho AI tư vấn.
  - Kết hợp XAIChart và AiAdvice để giải thích kết quả.
  Output y: dashboard kết quả gồm phần trăm nguy cơ, mức nguy cơ, XAI và lời khuyên.
*/

export default function ResultDashboard({ result, healthDataRaw }) {
  const navigate = useNavigate();

  const calculatedRisk = Number(result?.risk_percentage ?? 0);
  const tier = getRiskTier(calculatedRisk);

  const currentInputs = useMemo(() => {
    if (healthDataRaw && typeof healthDataRaw === 'object') {
      return formatHealthDataForAi(healthDataRaw);
    }
    if (result?.inputs) {
      return formatHealthDataForAi(result.inputs);
    }
    return {};
  }, [healthDataRaw, result?.inputs]);

  // Chuyển feature_importances dict thành XAI chart data format
  const xaiChartData = useMemo(() => {
    const featureNames = {
      'HighBP': 'Huyết áp cao',
      'HighChol': 'Cholesterol cao',
      'BMI': 'Chỉ số BMI',
      'Smoker': 'Hút thuốc',
      'Diabetes': 'Tiểu đường',
      'PhysActivity': 'Hoạt động thể chất',
      'Fruits': 'Ăn trái cây',
      'Veggies': 'Ăn rau xanh',
      'HvyAlcoholConsump': 'Uống rượu nhiều',
      'Age': 'Nhóm tuổi',
      'Sex': 'Giới tính'
    }

    if (result?.feature_contributions && typeof result.feature_contributions === 'object') {
      return Object.entries(result.feature_contributions)
        .map(([key, value]) => ({
          name: featureNames[key] || key,
          value: Math.round(Math.abs(value || 0) * 100 * 2), // Scale to visible range
          type: (value || 0) >= 0 ? 'danger' : 'safe'
        }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 5) // Top 5 features
    }
    if (result?.feature_importances && typeof result.feature_importances === 'object') {
      return Object.entries(result.feature_importances)
        .map(([key, value]) => ({
          name: featureNames[key] || key,
          value: Math.round((value || 0) * 100 * 2), // Scale to visible range
          type: value > 0.1 ? 'danger' : 'safe'
        }))
        .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
        .slice(0, 5) // Top 5 features
    }
    return []
  }, [result?.feature_contributions, result?.feature_importances]);

  const handleChatWithContext = () => {
    const summary = `Tôi vừa tầm soát tim mạch/đột quỵ với mức rủi ro ${calculatedRisk}% (mức ${
      result?.risk_level || 'chưa rõ'
    }). Dữ liệu: ${JSON.stringify(currentInputs)}. Xin bác sĩ AI tư vấn cụ thể các bước tôi nên làm tiếp theo.`;
    navigate('/chat', {
      state: {
        prefilledMessage: summary,
        fromRiskAssessment: true,
      },
    });
  };

  const renderRiskActionCard = () => {
    if (tier === 'low') {
      return (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 p-5 shadow-sm">
          <p className="font-bold text-base mb-1">💚 Tuyệt vời! Chỉ số trong ngưỡng an toàn.</p>
          <p className="text-xs text-emerald-700 mb-4 leading-relaxed">
            Hãy duy trì thói quen ăn uống, tập luyện lành mạnh và tầm soát định kỳ để giữ mức rủi ro thấp.
          </p>
          <button
            type="button"
            onClick={() => navigate('/diet-analyzer')}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-semibold text-sm hover:bg-emerald-700 active:scale-[0.98] transition-all shadow-sm"
          >
            🍎 Khám phá Thực đơn Dinh dưỡng AI
          </button>
        </div>
      );
    }

    if (tier === 'medium') {
      return (
        <div className="rounded-xl border border-amber-200 bg-amber-50 text-amber-800 p-5 shadow-sm">
          <p className="font-bold text-base mb-1">💛 Cảnh báo: Nguy cơ tiềm ẩn từ thói quen sinh hoạt.</p>
          <p className="text-xs text-amber-700 mb-4 leading-relaxed">
            Nên chủ động điều chỉnh lối sống sớm và trao đổi sâu thêm với bác sĩ AI về phác đồ phòng ngừa cá nhân.
          </p>
          <button
            type="button"
            onClick={handleChatWithContext}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 text-white font-semibold text-sm hover:bg-amber-700 active:scale-[0.98] transition-all shadow-sm"
          >
            💬 Nhắn tin sâu với Bác sĩ AI
          </button>
        </div>
      );
    }

    if (tier === 'high') {
      return (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-800 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-lg animate-bounce">🚨</span>
            <p className="font-bold text-base text-rose-700">CẢNH BÁO ĐỎ! Nguy cơ rất cao, cần chú ý khẩn cấp.</p>
          </div>
          <p className="text-xs text-rose-600 mb-4 leading-relaxed">
            Đây là cảnh báo từ hệ thống AI y tế — không thay thế chẩn đoán y khoa. Hãy đặc biệt lưu ý và nếu phát hiện triệu chứng đột ngột, vui lòng xử lý ngay.
          </p>
          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => navigate('/sos-map')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-rose-600 text-white font-bold hover:bg-rose-700 active:scale-[0.98] transition-all text-sm shadow-md"
            >
              🚑 Mở Bản đồ SOS & Gọi 115
            </button>
            <button
              type="button"
              onClick={() => navigate('/fast-test')}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border border-rose-300 text-rose-800 bg-white hover:bg-rose-50 active:scale-[0.98] transition-all text-sm font-semibold"
            >
              📷 Kiểm tra F.A.S.T qua Camera
            </button>
          </div>
        </div>
      );
    }

    return null;
  };

  if (!result) {
    return null;
  }

  const THEME_MAP = {
    low: {
      bgGradient: 'from-emerald-500 to-teal-600',
      badgeBg: 'bg-emerald-100 text-emerald-800',
      icon: '💚',
      title: 'Nguy cơ Thấp',
    },
    medium: {
      bgGradient: 'from-amber-500 to-orange-600',
      badgeBg: 'bg-amber-100 text-amber-800',
      icon: '💛',
      title: 'Nguy cơ Trung bình',
    },
    high: {
      bgGradient: 'from-red-500 to-rose-600',
      badgeBg: 'bg-rose-100 text-rose-800',
      icon: '🚨',
      title: 'Nguy cơ Cao',
    },
  };

  const theme = THEME_MAP[tier] || THEME_MAP.low;
  const radius = 42;
  const strokeWidth = 8;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (calculatedRisk / 100) * circumference;

  return (
    <div className="space-y-6 text-left">
      {/* Risk Summary Header Banner */}
      <div className={`rounded-2xl bg-gradient-to-r ${theme.bgGradient} p-6 sm:p-8 text-white relative overflow-hidden shadow-md`}>
        {/* Background abstract decoration */}
        <div className="absolute right-0 top-0 bottom-0 opacity-10 flex items-center justify-center pointer-events-none select-none">
          <span className="text-8xl font-black translate-x-6">{calculatedRisk}%</span>
        </div>
        
        <div className="relative z-10 flex flex-col md:flex-row items-center gap-6">
          <div className="relative flex items-center justify-center flex-shrink-0 bg-white/10 backdrop-blur-md rounded-full p-2 border border-white/20">
            <svg className="w-24 h-24 transform -rotate-90">
              <circle cx="48" cy="48" r={radius} stroke="rgba(255,255,255,0.2)" strokeWidth={strokeWidth} fill="transparent" />
              <circle
                cx="48"
                cy="48"
                r={radius}
                stroke="white"
                strokeWidth={strokeWidth}
                fill="transparent"
                strokeDasharray={circumference}
                strokeDashoffset={strokeDashoffset}
                strokeLinecap="round"
                className="transition-all duration-1000 ease-out"
                style={{ stroke: '#ffffff' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center text-center">
              <span className="text-2xl font-black text-white">{calculatedRisk}%</span>
              <span className="text-[9px] uppercase font-bold tracking-wider text-white/70">Rủi ro</span>
            </div>
          </div>
          
          <div className="flex-1 text-center md:text-left">
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2 mb-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/25 text-xs font-bold uppercase tracking-wider backdrop-blur-md border border-white/10">
                {theme.icon} {theme.title}
              </span>
              {result.is_anomaly && (
                <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-red-500/80 text-xs font-bold text-white animate-pulse border border-red-400/20">
                  ⚠️ Bất thường
                </span>
              )}
            </div>
            <h3 className="text-xl sm:text-2xl font-bold text-white tracking-tight">Kết quả đánh giá sức khỏe AI</h3>
            <p className="text-white/90 text-sm mt-1.5 leading-relaxed max-w-xl">
              {result.message || "Hãy theo dõi kỹ các khuyến nghị và biểu đồ phân tích dưới đây để có kế hoạch bảo vệ tim mạch tốt nhất."}
            </p>
          </div>
        </div>
      </div>

      <div>{renderRiskActionCard()}</div>

      {/* 2-Column Dashboard Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* XAI Column */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">🔍</span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">Explainable AI (XAI)</h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Mức đóng góp của từng yếu tố lâm sàng (Random Forest):
            </p>
            <div className="w-full">
              <XAIChart xaiData={xaiChartData} compact={true} />
            </div>
          </div>
          
          {/* Chart Legend */}
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-center gap-4 text-xs font-semibold">
            <span className="flex items-center gap-1.5 text-red-600">
              <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block"></span>
              Tăng nguy cơ
            </span>
            <span className="flex items-center gap-1.5 text-emerald-600">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Giảm nguy cơ
            </span>
          </div>
        </div>

        {/* Isolation Forest Column */}
        <div className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-sm flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xl">⚠️</span>
              <h4 className="font-bold text-slate-900 text-sm sm:text-base">
                Phát hiện dị thường (Isolation Forest)
              </h4>
            </div>
            <p className="text-[11px] text-slate-500 mb-4">
              Học không giám sát — đối chiếu chỉ số mới với mẫu dữ liệu huấn luyện:
            </p>
            <div
              className={`p-4 rounded-xl border text-xs leading-relaxed ${
                result.is_anomaly
                  ? 'bg-rose-50 border-rose-200 text-rose-900'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-900'
              }`}
            >
              {result.is_anomaly ? (
                <>
                  <strong className="text-rose-700 block mb-1">⚠️ Phát hiện chỉ số bất thường!</strong>
                  <p className="text-[11px] text-rose-600">
                    Chỉ số lần này lệch bất thường so với mô hình phân phối chuẩn. Hãy theo dõi sát sao sức khỏe hoặc trao đổi thêm với bác sĩ.
                  </p>
                </>
              ) : (
                <>
                  <strong className="text-emerald-700 block mb-1">✅ Ngưỡng an toàn ổn định</strong>
                  <p className="text-[11px] text-emerald-600">
                    Isolation Forest không phát hiện bất kỳ điểm dị thường hay bất thường đột biến nào ở lần đo này.
                  </p>
                </>
              )}
            </div>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 text-[11px] text-slate-400 text-center font-medium">
            Mô hình tự động cập nhật & hiệu chỉnh liên tục
          </div>
        </div>
      </div>

      <AiAdvice riskPercentage={calculatedRisk} healthData={currentInputs} />
    </div>
  );
}
