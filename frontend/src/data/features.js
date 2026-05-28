/** Danh mục 8 tính năng — đồng bộ đặc tả đồ án */
export const FEATURE_LABELS = {
  HighBP: 'Huyết áp cao',
  HighChol: 'Cholesterol cao',
  BMI: 'Chỉ số BMI',
  Smoker: 'Hút thuốc',
  Diabetes: 'Tiểu đường',
  PhysActivity: 'Vận động thể chất',
  Fruits: 'Ăn trái cây',
  Veggies: 'Ăn rau',
  HvyAlcoholConsump: 'Uống rượu nhiều',
  Age: 'Nhóm tuổi',
  Sex: 'Giới tính',
}

export const APP_FEATURES = [
  {
    id: 'risk',
    num: 1,
    category: 'core',
    title: 'Dashboard AI Tầm soát Rủi ro Tim mạch/Đột quỵ',
    shortTitle: 'Tầm soát rủi ro (ML)',
    description:
      'Người dùng nhập 11 chỉ số y tế cơ bản (huyết áp, cholesterol, BMI, thói quen hút thuốc, vận động, dinh dưỡng...). Hệ thống phân tích và trả về mức rủi ro ngay lập tức.',
    technology:
      'Học có giám sát (Supervised Learning) — Random Forest Classifier huấn luyện trên bộ dữ liệu chuẩn y khoa BRFSS 2015.',
    output:
      'Tỷ lệ phần trăm (%) rủi ro mắc bệnh, phân loại Thấp / Trung bình / Cao kèm cảnh báo màu sắc trực quan.',
    path: '/risk-assessment',
    cta: 'Nhập chỉ số & dự đoán',
    tag: 'Machine Learning',
  },
  {
    id: 'chat',
    num: 2,
    category: 'core',
    title: 'TÍNH NĂNG 02 | TRỢ LÝ ẢO & NHẬN DIỆN GIỌNG NÓI',
    shortTitle: 'Tư vấn AI (Voice)',
    description:
      'Hệ thống tư vấn y tế hoạt động 24/7. Được tích hợp công nghệ Speech-to-Text cho phép giao tiếp rảnh tay, thiết kế tối ưu hóa trải nghiệm cho người lớn tuổi.',
    technology:
      'Generative AI + LLM (Groq). Prompt Engineering định hình AI trả lời ấm áp, ngắn gọn, dễ hiểu, chuyên sâu tim mạch.',
    output: 'Hội thoại tư vấn tham khảo, lưu lịch sử trò chuyện.',
    path: '/chat',
    cta: 'Trò chuyện với bác sĩ AI',
    tag: 'LLM + Giọng nói',
  },
  {
    id: 'diet',
    num: 3,
    category: 'core',
    title: 'Đánh giá Dinh dưỡng Chủ động',
    shortTitle: 'Phân tích bữa ăn (NLP)',
    description:
      'Chế độ ăn là nguyên nhân hàng đầu của bệnh tim mạch. Người dùng mô tả món ăn; AI phân tích thành phần và cảnh báo nguy cơ.',
    technology:
      'Xử lý ngôn ngữ tự nhiên (NLP) bóc tách dinh dưỡng — phân tích mỡ, cholesterol, đường ẩn trong món ăn.',
    output: 'Nhận xét và lời khuyên điều chỉnh thực đơn hàng ngày.',
    path: '/diet-analyzer',
    cta: 'Phân tích bữa ăn',
    tag: 'NLP',
  },
  {
    id: 'history',
    num: 4,
    category: 'core',
    title: 'Quản lý Hồ sơ & Phân tích Xu hướng',
    shortTitle: 'Lịch sử & biểu đồ',
    description:
      'Toàn bộ lịch sử đo khám và chỉ số được lưu trữ an toàn, trích xuất và hình ảnh hóa theo thời gian.',
    technology: 'Data Visualization — biểu đồ đường (Line Chart) với Recharts.',
    output: 'Theo dõi biến thiên sức khỏe theo tuần/tháng để điều chỉnh kịp thời.',
    path: '/history',
    cta: 'Xem biểu đồ & lịch sử',
    tag: 'Health Tracking',
  },
  {
    id: 'sos',
    num: 5,
    category: 'core',
    title: 'Bản đồ Định vị Y tế Khẩn cấp (SOS)',
    shortTitle: 'SOS & bản đồ',
    description:
      'Khi khẩn cấp, thời gian là vàng. Chỉ cần ấn nút SOS — hệ thống lấy vị trí và hướng dẫn bệnh viện gần nhất.',
    technology:
      'Geolocation API thời gian thực + OpenStreetMap; tính khoảng cách tới bệnh viện cấp cứu.',
    output: 'Tọa độ GPS, bản đồ ghim vị trí, hotline bệnh viện & gọi 115/113.',
    path: '/sos-map',
    cta: 'Mở bản đồ SOS',
    tag: 'Khẩn cấp',
  },
  {
    id: 'xai',
    num: 6,
    category: 'advanced',
    title: 'Trí tuệ Nhân tạo Có thể giải thích (XAI)',
    shortTitle: 'Giải thích AI (XAI)',
    description:
      'Thay vì con số “hộp đen”, hệ thống giải thích lý do mức rủi ro — yếu tố nào làm tăng/giảm nguy cơ.',
    technology:
      'Feature Importance từ Random Forest (minh bạch hóa tương tự SHAP) — đóng góp từng chỉ số lâm sàng.',
    output: 'Biểu đồ đóng góp yếu tố; biết chính xác cần thay đổi thói quen nào.',
    path: '/risk-assessment',
    cta: 'Tầm soát để xem XAI',
    tag: 'Explainable AI',
    note: 'Hiển thị sau khi hoàn tất tầm soát rủi ro.',
  },
  {
    id: 'fast',
    num: 7,
    category: 'advanced',
    title: 'Tầm soát Đột quỵ qua Camera (F.A.S.T)',
    shortTitle: 'F.A.S.T Test',
    description:
      'Đột quỵ có biểu hiện sớm trên cơ mặt. Bật webcam để kiểm tra Face – Arms – Speech – Time theo chuẩn quốc tế.',
    technology:
      'Computer Vision + Deep Learning (mô phỏng 468 landmark); tính độ lệch (asymmetry) khóe miệng, mí mắt.',
    output: 'Cảnh báo khi phát hiện bất thường; kích hoạt báo động âm thanh khẩn.',
    path: '/fast-test',
    cta: 'Bắt đầu F.A.S.T Test',
    tag: 'Computer Vision',
  },
  {
    id: 'anomaly',
    num: 8,
    category: 'advanced',
    title: 'Cảnh báo Điểm dị thường (Anomaly Detection)',
    shortTitle: 'Giám sát dị thường',
    description:
      'Hệ thống giám sát chủ động — đối chiếu chỉ số mới với lịch sử cá nhân, phát hiện thay đổi đột biến.',
    technology: 'Học không giám sát — Isolation Forest chạy ngầm khi dự đoán rủi ro.',
    output: 'Cảnh báo đỏ khẩn khi phát hiện điểm bất thường so với chuỗi ổn định trước.',
    path: '/history',
    cta: 'Xem lịch sử & cảnh báo',
    tag: 'Isolation Forest',
    note: 'Kích hoạt tự động mỗi lần tầm soát; xem thêm tại Lịch sử.',
  },
]

export const CORE_FEATURES = APP_FEATURES.filter((f) => f.category === 'core')
export const ADVANCED_FEATURES = APP_FEATURES.filter((f) => f.category === 'advanced')

export function getFeatureById(id) {
  return APP_FEATURES.find((f) => f.id === id)
}
