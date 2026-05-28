import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import XAIChart from './XAIChart';
import AiAdvice from './AiAdvice';
import { formatHealthDataForAi, getRiskTier } from '../data/healthFormLabels';

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
  }, [result?.feature_importances]);

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
        <div className="rounded-xl border border-green-200 bg-green-50 text-green-800 p-5 sm:p-6">
          <p className="font-bold text-lg mb-2">Tuyệt vời! Chỉ số trong ngưỡng an toàn.</p>
          <p className="text-sm text-green-700 mb-5 leading-relaxed">
            Hãy duy trì thói quen lành mạnh và theo dõi định kỳ để giữ mức rủi ro thấp.
          </p>
          <button
            type="button"
            onClick={() => navigate('/diet-analyzer')}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-green-600 text-white font-bold hover:bg-green-700 transition-colors shadow-sm"
          >
            🍎 Khám phá Thực đơn Dinh dưỡng AI
          </button>
        </div>
      );
    }

    if (tier === 'medium') {
      return (
        <div className="rounded-xl border border-orange-200 bg-orange-50 text-orange-800 p-5 sm:p-6">
          <p className="font-bold text-lg mb-2">Cảnh báo. Bạn có nguy cơ tiềm ẩn từ thói quen sinh hoạt.</p>
          <p className="text-sm text-orange-700 mb-5 leading-relaxed">
            Nên điều chỉnh lối sống sớm và trao đổi thêm với bác sĩ AI về kế hoạch phòng ngừa cá nhân.
          </p>
          <button
            type="button"
            onClick={handleChatWithContext}
            className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-orange-600 text-white font-bold hover:bg-orange-700 transition-colors shadow-sm"
          >
            💬 Nhắn tin sâu với Bác sĩ AI
          </button>
        </div>
      );
    }

    if (tier === 'high') {
      return (
        <div className="rounded-xl border border-red-300 bg-red-50 text-red-800 p-5 sm:p-6 animate-pulse">
          <p className="font-bold text-lg mb-2">CẢNH BÁO ĐỎ! Nguy cơ rất cao, hãy chú ý sức khỏe khẩn cấp.</p>
          <p className="text-sm text-red-700 mb-5 leading-relaxed">
            Đây là cảnh báo từ mô hình AI — không thay chẩn đoán y khoa. Nếu có triệu chứng đột ngột, gọi 115 ngay.
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={() => navigate('/sos-map')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl bg-red-600 text-white font-bold hover:bg-red-700 transition-colors shadow-md"
            >
              🚑 Mở Bản đồ SOS & Gọi 115
            </button>
            <button
              type="button"
              onClick={() => navigate('/fast-test')}
              className="flex-1 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl border-2 border-red-600 text-red-800 font-bold bg-white hover:bg-red-100 transition-colors"
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

  return (
    <div className="rounded-2xl p-6 sm:p-8 bg-white border border-slate-200 shadow-card">
      {result.is_anomaly && (
        <div className="mb-4 px-4 py-3 rounded-xl bg-red-600 text-white font-bold text-center animate-pulse">
          CẢNH BÁO ĐỎ — Isolation Forest phát hiện điểm dị thường
        </div>
      )}

      <h3 className="text-2xl font-bold text-slate-900 mb-6">Kết quả đánh giá</h3>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-6">
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-1">Tỷ lệ rủi ro</p>
          <p className="text-4xl sm:text-5xl font-extrabold text-slate-900">{calculatedRisk}%</p>
        </div>
        <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500 mb-1">Mức độ</p>
          <p className="text-3xl sm:text-4xl font-extrabold text-slate-900">{result.risk_level}</p>
        </div>
      </div>

      {result.message && (
        <div className="bg-slate-50 rounded-xl p-5 mb-6 border border-slate-100">
          <p className="text-base sm:text-lg leading-relaxed text-slate-700">{result.message}</p>
        </div>
      )}

      <div className="mb-6">{renderRiskActionCard()}</div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        <XAIChart xaiData={xaiChartData} />

        <div className="bg-white rounded-xl p-5 border border-slate-200">
          <h4 className="font-bold text-slate-900 mb-1">
            Cảnh báo dị thường (Isolation Forest)
          </h4>
          <p className="text-sm text-slate-600 mb-4">
            Học không giám sát — đối chiếu chỉ số mới với mẫu huấn luyện:
          </p>
          <div
            className={`p-4 rounded-xl border text-sm leading-relaxed ${
              result.is_anomaly
                ? 'bg-red-50 border-red-300 text-red-900'
                : 'bg-brand-50 border-brand-200 text-brand-900'
            }`}
          >
            {result.is_anomaly ? (
              <>
                <strong className="text-red-700">CẢNH BÁO ĐỎ — Phát hiện điểm dị thường!</strong>
                <p className="mt-2">
                  Chỉ số lần này lệch bất thường so với mô hình chuẩn. Nên theo dõi sát hoặc liên hệ
                  bác sĩ, đặc biệt nếu kèm triệu chứng đột ngột.
                </p>
              </>
            ) : (
              <>
                <strong>Tình trạng trong ngưỡng ổn định.</strong>
                <p className="mt-2">
                  Isolation Forest không phát hiện điểm bất thường đột biến ở lần đo này.
                </p>
              </>
            )}
          </div>
        </div>
      </div>

      <AiAdvice riskPercentage={calculatedRisk} healthData={currentInputs} />
    </div>
  );
}
