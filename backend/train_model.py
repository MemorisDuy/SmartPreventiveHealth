# GHI CHÚ VẤN ĐÁP:
# File này dùng để huấn luyện mô hình học máy chính của dự án.
# Dữ liệu đầu vào là bộ BRFSS 2015, trong đó:
# - X là 11 đặc trưng sức khỏe: huyết áp, cholesterol, BMI, hút thuốc,
#   tiểu đường, vận động, ăn trái cây, ăn rau, uống rượu nhiều, tuổi và giới tính.
# - y là cột target HeartDiseaseorAttack, biểu diễn có/không liên quan bệnh tim hoặc đột quỵ.
# Thuật toán chính:
# - RandomForestClassifier: học có giám sát, dùng để dự đoán xác suất nguy cơ.
# - IsolationForest: học không giám sát, dùng để phát hiện bộ chỉ số bất thường.
# Output của file này là 2 file model .pkl:
# - heart_risk_model.pkl cho Random Forest.
# - anomaly_detector.pkl cho Isolation Forest.

# Train Model Script - Huấn luyện mô hình Random Forest
# Dữ liệu: BRFSS 2015 từ CDC Mỹ
# Target: HeartDiseaseorAttack (Rủi ro Tim mạch & Đột quỵ)

import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
import joblib
import os

print("=" * 80)
print("KHỞI ĐỘNG HUẤN LUYỆN MÔ HÌNH RANDOM FOREST")
print("=" * 80)

# Bước 1: Tải dữ liệu từ file CSV
print("\n[BƯỚC 1] Đang tải dữ liệu từ file CSV...")
print("Tìm kiếm file: heart_disease_health_indicators_BRFSS2015.csv")

try:
    df = pd.read_csv("heart_disease_health_indicators_BRFSS2015.csv")
    print(f"✓ Tải dữ liệu thành công!")
    print(f"  - Tổng số bản ghi: {len(df):,}")
    print(f"  - Tổng số cột: {len(df.columns)}")
except FileNotFoundError:
    print("✗ Lỗi: Không tìm thấy file heart_disease_health_indicators_BRFSS2015.csv")
    print("  Đảm bảo file CSV nằm trong thư mục hiện tại!")
    exit(1)

# Bước 2: Chọn 11 features cốt lõi (theo đặc tả hệ thống)
print("\n[BƯỚC 2] Lọc 11 features cốt lõi từ dữ liệu...")

features = [
    'HighBP',                    # Huyết áp cao
    'HighChol',                  # Cholesterol cao
    'BMI',                       # Chỉ số khối lượng cơ thể
    'Smoker',                    # Hút thuốc
    'Diabetes',                  # Tiểu đường
    'PhysActivity',              # Hoạt động thể chất
    'Fruits',                    # Ăn trái cây hàng ngày
    'Veggies',                   # Ăn rau hàng ngày
    'HvyAlcoholConsump',         # Uống rượu nhiều
    'Age',                       # Nhóm tuổi
    'Sex'                        # Giới tính
]

print(f"Các features được sử dụng:")
for i, feat in enumerate(features, 1):
    print(f"  {i:2d}. {feat}")

# Kiểm tra xem tất cả features có trong dữ liệu không
missing_features = [f for f in features if f not in df.columns]
if missing_features:
    print(f"\n✗ Lỗi: Các features sau không có trong dữ liệu: {missing_features}")
    print(f"Các cột có sẵn: {list(df.columns)}")
    exit(1)

X = df[features]
print(f"✓ Đã chọn {len(features)} features thành công!")

# Kiểm tra target
if 'HeartDiseaseorAttack' not in df.columns:
    print(f"✗ Lỗi: Cột target 'HeartDiseaseorAttack' không có trong dữ liệu")
    print(f"Các cột có sẵn: {list(df.columns)}")
    exit(1)

y = df['HeartDiseaseorAttack']
print(f"✓ Target variable 'HeartDiseaseorAttack' đã sẵn sàng")
print(f"  - Số lượng class 0 (Không): {(y == 0).sum():,}")
print(f"  - Số lượng class 1 (Có): {(y == 1).sum():,}")

# Bước 3: Phân chia tập dữ liệu Train/Test (80/20)
print("\n[BƯỚC 3] Phân chia tập dữ liệu Train/Test (80/20)...")

X_train, X_test, y_train, y_test = train_test_split(
    X, y, test_size=0.2, random_state=42, stratify=y
)

print(f"✓ Phân chia thành công!")
print(f"  - Tập Train: {len(X_train):,} bản ghi ({len(X_train)/len(X)*100:.1f}%)")
print(f"  - Tập Test:  {len(X_test):,} bản ghi ({len(X_test)/len(X)*100:.1f}%)")
print(f"  - Train - Class 0: {(y_train == 0).sum():,}, Class 1: {(y_train == 1).sum():,}")
print(f"  - Test  - Class 0: {(y_test == 0).sum():,}, Class 1: {(y_test == 1).sum():,}")

# Bước 4: Huấn luyện mô hình Random Forest
print("\n[BƯỚC 4] Bắt đầu huấn luyện mô hình Random Forest...")
print("  Cấu hình: n_estimators=100, random_state=42, n_jobs=-1 (dùng tất cả CPU cores)")

model = RandomForestClassifier(
    n_estimators=100,
    random_state=42,
    n_jobs=-1,
    verbose=1
)

model.fit(X_train, y_train)
print("✓ Huấn luyện hoàn tất!")

# Bước 5: Đánh giá mô hình trên tập Test
print("\n[BƯỚC 5] Đánh giá mô hình...")

y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)

print(f"\n📊 KẾT QUẢ ĐÁNH GIÁ:")
print(f"  - Độ chính xác (Accuracy): {accuracy:.4f} ({accuracy*100:.2f}%)")

# In ra chi tiết classification report
print("\n📈 Chi tiết Classification Report:")
print(classification_report(y_test, y_pred, target_names=['Không có rủi ro', 'Có rủi ro']))

# In ra confusion matrix
print("\n📋 Confusion Matrix:")
cm = confusion_matrix(y_test, y_pred)
print(f"  True Negatives:  {cm[0,0]:,}  |  False Positives: {cm[0,1]:,}")
print(f"  False Negatives: {cm[1,0]:,}  |  True Positives:  {cm[1,1]:,}")

# Feature importance
print("\n🎯 Độ quan trọng các Features (Top 5):")
feature_importance = pd.DataFrame({
    'feature': features,
    'importance': model.feature_importances_
}).sort_values('importance', ascending=False)

for idx, row in feature_importance.head(5).iterrows():
    print(f"  {idx+1}. {row['feature']:20s}: {row['importance']:.4f}")

# Bước 6: Huấn luyện Isolation Forest cho Anomaly Detection
print("\n[BƯỚC 6] Huấn luyện Isolation Forest (Anomaly Detection)...")
iso_forest = IsolationForest(contamination=0.05, random_state=42)
iso_forest.fit(X_train)
print("✓ Huấn luyện Isolation Forest hoàn tất!")

# Bước 7: Lưu các mô hình vào file
print("\n[BƯỚC 7] Lưu mô hình vào file...")

# Lưu Random Forest
rf_path = "heart_risk_model.pkl"
joblib.dump(model, rf_path)

# Lưu Isolation Forest
iso_path = "anomaly_detector.pkl"
joblib.dump(iso_forest, iso_path)

if os.path.exists(rf_path) and os.path.exists(iso_path):
    print(f"✓ Lưu các mô hình thành công!")
    print(f"  - Random Forest: {os.path.abspath(rf_path)}")
    print(f"  - Isolation Forest: {os.path.abspath(iso_path)}")
else:
    print(f"✗ Lỗi: Không thể lưu đầy đủ các mô hình")
    exit(1)

print("\n" + "=" * 80)
print("✓ HUẤN LUYỆN HOÀN TẤT THÀNH CÔNG!")
print("=" * 80)
print("\nHệ thống sẵn sàng khởi động FastAPI Backend!")
print("Lệnh chạy: uvicorn main:app --reload")
