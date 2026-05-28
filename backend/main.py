 # FastAPI Backend - SmartPreventiveHealth
# Nền tảng AI Phòng Chống Bệnh Tim mạch & Đột quỵ Toàn Lứa Tuổi
# Các endpoints: /api/register, /api/login, /api/predict, /api/chat, /api/history, /api/health

import os
import sys
import base64
import io
from PIL import Image
import PIL.PngImagePlugin

# Windows: tránh UnicodeEncodeError khi in log tiếng Việt
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

import bcrypt
import joblib
import pandas as pd
import mysql.connector
from datetime import datetime
from fastapi import FastAPI, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import google.generativeai as genai
import tempfile
import uuid
from dotenv import load_dotenv

# Load biến môi trường từ file .env
load_dotenv()

# Khởi tạo FastAPI app
app = FastAPI(
    title="SmartPreventiveHealth",
    description="Nền tảng AI Phòng Chống Bệnh Tim mạch & Đột quỵ - Toàn Lứa Tuổi",
    version="2.0.0"
)

# Cấu hình CORS - cho phép React dev server (localhost:5173) gọi được API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Cho phép tất cả origins (có thể giới hạn sau)
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# 1. LOAD AI MODEL (1 lần khi khởi động app)
# ============================================================================
print("[INFO] Đang tải mô hình AI...")
MODEL_LOADED = False
rf_model = None
iso_forest = None

try:
    if os.path.exists("heart_risk_model.pkl"):
        rf_model = joblib.load("heart_risk_model.pkl")
        MODEL_LOADED = True
        print("✓ Mô hình Heart Risk Random Forest đã tải thành công!")
    
    if os.path.exists("anomaly_detector.pkl"):
        iso_forest = joblib.load("anomaly_detector.pkl")
        print("✓ Mô hình Anomaly Detector (Isolation Forest) đã tải thành công!")
except Exception as e:
    print(f"✗ Lỗi load model: {e}")
    MODEL_LOADED = False

# ============================================================================
# 2. KHỞI TẠO GEMINI CLIENT (Chatbot AI)
# ============================================================================
gemini_model = None

print("\n[INFO] Khởi tạo Gemini API...")
print(f"[DEBUG] Kiểm tra GEMINI_API_KEY từ environment...")

gemini_key = os.getenv("GEMINI_API_KEY")
if not gemini_key:
    print("❌ LỖI NGHIÊM TRỌNG: Không tìm thấy GEMINI_API_KEY trong file .env!")
    print("   Giải pháp: Thêm GEMINI_API_KEY=<key> vào file backend/.env và khởi động lại server.")
else:
    try:
        print(f"[DEBUG] Tìm thấy GEMINI_API_KEY: {gemini_key[:20]}...")
        genai.configure(api_key=gemini_key)
        # Sử dụng gemini-flash-latest - model nhanh nhất (3.15s)
        gemini_model = genai.GenerativeModel('gemini-flash-latest')
        print("✅ Đã kết nối Gemini API (gemini-flash-latest) thành công!")
    except Exception as init_err:
        print(f"❌ Lỗi cấu hình Gemini: {init_err}")
        print(f"[DEBUG] Lỗi chi tiết: {type(init_err).__name__}: {str(init_err)}")
        gemini_model = None

print("\n" + "="*80)
print()

# ============================================================================
# 3. DATABASE CONNECTION FUNCTION
# ============================================================================
def get_db_connection():
    """Tạo kết nối tới MySQL database"""
    try:
        conn = mysql.connector.connect(
            host=os.getenv("DB_HOST", "localhost"),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcare_db")
        )
        return conn
    except mysql.connector.Error as err:
        print(f"Lỗi kết nối DB: {err}")
        raise

# ============================================================================
# 4. PYDANTIC MODELS - Định nghĩa request/response schemas
# ============================================================================

class RegisterRequest(BaseModel):
    """Schema for user registration"""
    full_name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    """Schema for user login"""
    email: str
    password: str

class PredictRequest(BaseModel):
    """Schema for health risk prediction"""
    user_id: int
    HighBP: int              # Huyết áp cao: 0/1
    HighChol: int            # Cholesterol cao: 0/1
    BMI: float               # Chỉ số khối lượng: 15-60
    Smoker: int              # Hút thuốc: 0/1
    Diabetes: int            # Tiểu đường: 0/1/2
    PhysActivity: int        # Hoạt động thể chất: 0/1
    Fruits: int              # Ăn trái cây: 0/1
    Veggies: int             # Ăn rau: 0/1
    HvyAlcoholConsump: int   # Uống rượu nhiều: 0/1
    Age: int                 # Nhóm tuổi: 1-13
    Sex: int                 # Giới tính: 0=Nữ/1=Nam

class ChatRequest(BaseModel):
    """Schema for chatbot interaction"""
    user_id: int
    message: str
    chat_type: str = "general"  # "general" hoặc "diet"

class HealthAdviceRequest(BaseModel):
    """Schema for AI health advice after risk assessment"""
    risk_percentage: float
    health_data: dict

class MealRequest(BaseModel):
    """Schema for meal analysis (text + optional image)"""
    description: str = ""
    image_base64: str = ""

class EmergencyRequest(BaseModel):
    """Schema for emergency alert diagnosis (image-based)"""
    image_base64: str
    alert_type: str  # "Face Asymmetry" (Méo miệng) hoặc "Fall Detection" (Té ngã)


# ============================================================================
# GEMINI HELPERS
# ============================================================================
MAX_IMAGE_BASE64_LEN = 10 * 1024 * 1024  # ~10MB encoded (hỗ trợ ảnh ~7-8MB)


def require_gemini():
    if gemini_model is None:
        raise HTTPException(
            status_code=503,
            detail="Gemini API chưa cấu hình. Thêm GEMINI_API_KEY vào backend/.env và khởi động lại server.",
        )


# ============================================================================
# 5. API ENDPOINTS
# ============================================================================

@app.get("/api/health")
def health_check():
    """Health check endpoint - kiểm tra trạng thái hệ thống"""
    return {
        "status": "ok",
        "model_loaded": MODEL_LOADED,
        "timestamp": datetime.now().isoformat()
    }

# ============================================================================
# ENDPOINT: POST /api/register - Đăng ký tài khoản mới
# ============================================================================
@app.post("/api/register")
def register(req: RegisterRequest):
    """
    Đăng ký tài khoản mới
    - Hash password bằng bcrypt
    - Kiểm tra email đã tồn tại
    """
    try:
        # Kết nối DB
        conn = get_db_connection()
        cursor = conn.cursor()

        # Kiểm tra email đã tồn tại?
        cursor.execute("SELECT user_id FROM users WHERE email=%s", (req.email,))
        if cursor.fetchone():
            raise HTTPException(status_code=400, detail="Email đã tồn tại trong hệ thống!")

        # Hash password bằng bcrypt
        salt = bcrypt.gensalt(rounds=12)
        hashed_pw = bcrypt.hashpw(req.password.encode('utf-8'), salt).decode('utf-8')

        # Thêm user mới vào DB
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s)",
            (req.full_name, req.email, hashed_pw)
        )
        conn.commit()
        user_id = cursor.lastrowid

        print(f"[INFO] User mới đã đăng ký: {req.email} (ID: {user_id})")

        return {
            "success": True,
            "user_id": user_id,
            "message": "Đăng ký thành công! Vui lòng đăng nhập."
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Register error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi server: {str(e)}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: POST /api/login - Đăng nhập
# ============================================================================
@app.post("/api/login")
def login(req: LoginRequest):
    """
    Đăng nhập - xác thực email/password
    - Verify bcrypt hash
    - Trả về user_id và full_name
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        # Lấy user từ email
        cursor.execute(
            "SELECT user_id, full_name, password_hash FROM users WHERE email=%s",
            (req.email,)
        )
        user = cursor.fetchone()

        # Kiểm tra user và password
        if not user or not bcrypt.checkpw(req.password.encode('utf-8'), user['password_hash'].encode('utf-8')):
            raise HTTPException(status_code=400, detail="Sai email hoặc mật khẩu!")

        print(f"[INFO] User đăng nhập thành công: {req.email} (ID: {user['user_id']})")

        return {
            "success": True,
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "message": "Đăng nhập thành công!"
        }

    except HTTPException as e:
        raise e
    except Exception as e:
        print(f"[ERROR] Login error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi server: {str(e)}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: POST /api/predict - Dự đoán rủi ro Tim mạch & Đột quỵ
# ============================================================================
@app.post("/api/predict")
def predict_risk(req: PredictRequest):
    """
    Dự đoán rủi ro Tim mạch & Đột quỵ
    - Load model từ .pkl file
    - Predict xác suất risk
    - Lưu kết quả vào health_records
    - Phân loại risk level: Thấp (<30%), Trung bình (30-60%), Cao (>60%)
    """
    if not MODEL_LOADED:
        raise HTTPException(status_code=500, detail="AI Model chưa sẵn sàng. Vui lòng chạy train_model.py trước!")

    try:
        # Chuẩn bị dữ liệu cho model
        # Thứ tự features phải khớp với thứ tự trong train_model.py
        input_data = pd.DataFrame([{
            'HighBP': req.HighBP,
            'HighChol': req.HighChol,
            'BMI': req.BMI,
            'Smoker': req.Smoker,
            'Diabetes': req.Diabetes,
            'PhysActivity': req.PhysActivity,
            'Fruits': req.Fruits,
            'Veggies': req.Veggies,
            'HvyAlcoholConsump': req.HvyAlcoholConsump,
            'Age': req.Age,
            'Sex': req.Sex
        }])

        # Dự đoán xác suất
        risk_prob = rf_model.predict_proba(input_data)[0][1] * 100

        # Kiểm tra dị thường (Isolation Forest)
        is_anomaly = False
        if iso_forest is not None:
            # predict() trả về -1 cho anomaly, 1 cho normal
            anomaly_score = iso_forest.predict(input_data)[0]
            is_anomaly = True if anomaly_score == -1 else False

        # Phân loại mức độ rủi ro
        if risk_prob < 30:
            risk_level = "Thấp"
            message = "✓ Tình trạng của bạn tốt. Hãy tiếp tục duy trì lối sống lành mạnh!"
        elif risk_prob <= 60:
            risk_level = "Trung bình"
            message = "⚠ Bạn cần chú ý hơn đến sức khỏe. Tăng vận động và kiểm soát chế độ ăn."
        else:
            risk_level = "Cao"
            message = "🚨 Rủi ro cao! Vui lòng liên hệ bác sĩ ngay để tư vấn."

        # Lưu kết quả vào database
        conn = get_db_connection()
        cursor = conn.cursor()

        sql = """
            INSERT INTO health_records 
            (user_id, HighBP, HighChol, BMI, Smoker, Diabetes, PhysActivity, 
             Fruits, Veggies, HvyAlcoholConsump, Age, Sex, risk_percentage, risk_level, is_anomaly) 
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        """
        values = (
            req.user_id, req.HighBP, req.HighChol, req.BMI, req.Smoker,
            req.Diabetes, req.PhysActivity, req.Fruits, req.Veggies,
            req.HvyAlcoholConsump, req.Age, req.Sex, float(risk_prob), risk_level, int(is_anomaly)
        )

        cursor.execute(sql, values)
        conn.commit()

        # Feature Importance for XAI
        importances = {}
        if rf_model is not None:
            feature_names = [
                'HighBP', 'HighChol', 'BMI', 'Smoker', 'Diabetes', 'PhysActivity', 
                'Fruits', 'Veggies', 'HvyAlcoholConsump', 'Age', 'Sex'
            ]
            for i, name in enumerate(feature_names):
                importances[name] = float(rf_model.feature_importances_[i])

        print(f"[INFO] Health record saved - User {req.user_id}: Risk {risk_prob:.2f}% ({risk_level})")

        return {
            "risk_percentage": round(risk_prob, 2),
            "risk_level": risk_level,
            "is_anomaly": is_anomaly,
            "message": message,
            "feature_importances": importances,
            "inputs": {
                "HighBP": req.HighBP,
                "HighChol": req.HighChol,
                "BMI": req.BMI,
                "Smoker": req.Smoker,
                "Diabetes": req.Diabetes,
                "PhysActivity": req.PhysActivity,
                "Fruits": req.Fruits,
                "Veggies": req.Veggies,
                "HvyAlcoholConsump": req.HvyAlcoholConsump,
                "Age": req.Age,
                "Sex": req.Sex
            },
            "timestamp": datetime.now().isoformat()
        }

    except Exception as e:
        print(f"[ERROR] Predict error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi dự đoán: {str(e)}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: POST /api/health-advice - Lời khuyên AI sau tầm soát
# ============================================================================
@app.post("/api/health-advice")
def health_advice(req: HealthAdviceRequest):
    """Tạo 3 gạch đầu dòng lời khuyên từ Gemini (proxy an toàn cho frontend)."""
    require_gemini()

    system_prompt = (
        "Bạn là một bác sĩ tim mạch giàu kinh nghiệm. Hãy đưa ra chính xác 3 gạch đầu dòng "
        "lời khuyên hành động ngắn gọn, thiết thực, ấm áp bằng tiếng Việt dựa vào dữ liệu sức khỏe "
        "của bệnh nhân. Không sử dụng markdown in đậm, in nghiêng hoặc ký tự đặc biệt."
    )
    user_prompt = (
        f"Bệnh nhân có mức nguy cơ đột quỵ được máy tính báo là {req.risk_percentage}%. "
        f"Đây là dữ liệu y sinh cụ thể: {req.health_data}."
    )

    try:
        full_prompt = f"{system_prompt}\n\n{user_prompt}"
        response = gemini_model.generate_content(full_prompt, generation_config=genai.types.GenerationConfig(
            max_output_tokens=300,
            temperature=0.7,
        ))
        advice = response.text
        return {"advice": advice}
    except HTTPException:
        raise
    except Exception as e:
        print(f"[ERROR] Health advice error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi Gemini: {str(e)}")

# ============================================================================
# ENDPOINT: POST /api/analyze-meal - Phân tích bữa ăn (text + ảnh)
# ============================================================================
@app.post("/api/analyze-meal")
def analyze_meal(req: MealRequest):
    """Phân tích dinh dưỡng bằng Gemini — hỗ trợ mô tả văn bản và ảnh món ăn."""
    require_gemini()

    description = (req.description or "").strip()
    base64_data = (req.image_base64 or "").strip()
    
    # Làm sạch chuỗi Base64 (cắt bỏ phần prefix data:image/...;base64,)
    if "," in base64_data:
        base64_data = base64_data.split(",")[1]

    has_image = bool(base64_data)

    if not description and not has_image:
        raise HTTPException(status_code=400, detail="Vui lòng nhập mô tả hoặc tải ảnh bữa ăn.")

    system_prompt = (
        "Bạn là Chuyên gia Dinh dưỡng AI hàng đầu, chuyên về tim mạch và phòng chống đột quỵ.\n\n"
        "HƯỚNG DẪN PHÂN TÍCH CHI TIẾT:\n"
        "1. **Xác định BỮA ĂN**: Tên món ăn, thành phần chính (đặc biệt nếu có ảnh)\n"
        "2. **THÀNH PHẦN DINH DƯỠNG**: Ước lượng (trên 100g hoặc toàn bộ bữa):\n"
        "   - Calo\n"
        "   - Protein (g)\n"
        "   - Chất béo tổng (g) và chất béo bão hòa (g)\n"
        "   - Carbohydrate (g) và đường (g)\n"
        "   - Muối/Sodium (mg)\n"
        "   - Chất xơ (g)\n"
        "3. **ĐÁNH GIÁ TÁC ĐỘNG TIM MẠCH**:\n"
        "   - Mức độ: TUYỆT VỜI / TỐT / TRUNG BÌNH / CÓ RỦI RO / CẦN HẠN CHẾ\n"
        "   - Giải thích CHỈ TỚ: cholesterol, đường, muối, chất béo bão hòa\n"
        "   - TẠI SAO bữa ăn này ảnh hưởng đến tim mạch?\n"
        "4. **LỜI KHUYÊN THỰC TIỄN** (3-5 gạch đầu dòng):\n"
        "   - Cách cải thiện bữa ăn này\n"
        "   - Thay thế an toàn\n"
        "   - Lưu ý khi ăn lần tới\n\n"
        "TỔNG CỘNG: 200-300 từ, viết CHI TIẾT và dễ hiểu.\n"
        "KHÔNG dùng markdown phức tạp, không giới hạn về độ dài câu."
    )

    try:
        if has_image:
            if len(base64_data) > (MAX_IMAGE_BASE64_LEN * 1.5): # Dự phòng size
                raise HTTPException(status_code=400, detail="Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 4MB.")

            text_part = (
                f"{system_prompt}\n\nMô tả thêm: {description}"
                if description
                else f"{system_prompt}\n\nHãy nhận diện món ăn trong ảnh và phân tích dinh dưỡng."
            )
            
            # Gọi Gemini Vision API (Inline Data mode)
            response = gemini_model.generate_content([
                text_part,
                {
                    "mime_type": "image/jpeg", # Gemini hỗ trợ auto-detect từ bytes tốt
                    "data": base64_data,
                }
            ], generation_config=genai.types.GenerationConfig(
                max_output_tokens=2000,
                temperature=0.8,
            ))
        else:
            # Chỉ phân tích text
            user_text = f"Phân tích bữa ăn sau và đánh giá tác động tim mạch/cholesterol: {description}"
            full_prompt = f"{system_prompt}\n\n{user_text}"
            response = gemini_model.generate_content(full_prompt, generation_config=genai.types.GenerationConfig(
                max_output_tokens=2000,
                temperature=0.8,
            ))

        reply = response.text
        return {
            "reply": reply,
            "has_image": has_image,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        print(f"[ERROR] Analyze meal error: {type(e).__name__}: {e}")
        print(f"[DEBUG] Chi tiết lỗi: {str(e)}")
        import traceback
        traceback.print_exc()
        raise HTTPException(status_code=500, detail=f"Lỗi AI Vision: {str(e)}")

# ============================================================================
# ENDPOINT: POST /api/emergency-alert - Chẩn đoán cấp cứu bằng hình ảnh
# ============================================================================
@app.post("/api/emergency-alert")
async def handle_emergency_alert(request: EmergencyRequest):
    try:
        base64_data = request.image_base64
        
        # 1. BẮT BUỘC: Xử lý tiền tố của chuỗi Base64
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
            
        # Sửa lỗi 500: Thêm padding Base64 nếu bị khuyết
        missing_padding = len(base64_data) % 4
        if missing_padding:
            base64_data += "=" * (4 - missing_padding)
            
        # 2. Giải mã và chuyển thành ảnh PIL cho Gemini
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))
        
        # 3. Gọi Gemini Vision
        model = genai.GenerativeModel('gemini-flash-latest')
        prompt = f"Đây là hình ảnh bệnh nhân được camera giám sát chụp lại khi phát hiện dấu hiệu {request.alert_type}. Bạn là bác sĩ cấp cứu. Dựa vào tư thế trong ảnh, hãy đưa ra 3 bước sơ cứu khẩn cấp ngắn gọn nhất. Không cần giải thích thêm."
        
        response = model.generate_content([prompt, img])
        
        try:
            advice = response.text
        except ValueError:
            # Bị block do bộ lọc an toàn của Gemini
            advice = "Hình ảnh hoặc yêu cầu bị Gemini AI chặn (Safety Filter). Vui lòng gọi ngay 115 để được hướng dẫn sơ cứu khẩn cấp."
        
        return {"emergency_advice": advice}
        
    except Exception as e:
        print(f"❌ LỖI GEMINI API: {str(e)}")
        # Trả về 500 nhưng kèm thông điệp rõ ràng để dễ debug
        raise HTTPException(status_code=500, detail=str(e))

# ============================================================================
# ENDPOINT: POST /api/chat - Chat với Bác sĩ AI (Gemini)
# ============================================================================
@app.post("/api/chat")
def chat(req: ChatRequest):
    """
    Chat với Bác sĩ AI
    - Gọi Google Gemini API
    - System prompt: Bác sĩ AI chuyên tim mạch & dinh dưỡng
    - Lưu lịch sử vào chat_logs
    """
    require_gemini()

    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống.")

    conn = None
    try:
        # Xác thực dữ liệu từ Frontend
        user_id = req.user_id
        message_text = req.message.strip()
        chat_type = req.chat_type or "general"

        print(f"[DEBUG] Chat request - User: {user_id}, Type: {chat_type}, Message: {message_text[:100]}")

        # Chọn system prompt dựa vào loại chat
        if chat_type == "diet":
            system_prompt = (
                "Bạn là Chuyên gia Dinh dưỡng AI chuyên về tim mạch cho người Việt Nam.\n"
                "HƯỚNG DẪN:\n"
                "- Trả lời CHI TIẾT, cụ thể và đầy đủ (5-10 câu nếu cần).\n"
                "- Phân tích thành phần dinh dưỡng: cholesterol, đường, muối, chất béo với VÍ DỤ cụ thể.\n"
                "- Giải thích TẠI SAO những thành phần này ảnh hưởng đến tim mạch.\n"
                "- Đưa ra LỜI KHUYÊN CỤ THỂ và THỰC TIỄN để bảo vệ tim mạch.\n"
                "- Giọng điệu: thân thiện, chuyên nghiệp, không khô khan.\n"
                "- CHỈ TRẢ LỜI CHI TIẾT - không kèm ghi chú hay template."
            )
        else:
            system_prompt = (
                "Bạn là Bác sĩ AI gia đình chuyên về tim mạch và phòng ngừa đột quỵ cho người Việt Nam.\n"
                "HƯỚNG DẪN:\n"
                "- Trả lời CHI TIẾT, cụ thể và đầy đủ (5-10 câu nếu cần).\n"
                "- Giải thích RỊ TƯỞNG cụ thể, dễ hiểu cho người bình thường.\n"
                "- Cung cấp LỜI KHUYÊN THỰC TẾ mà bệnh nhân có thể áp dụng ngay.\n"
                "- Nếu triệu chứng nghiêm trọng, NHẮC gặp bác sĩ hoặc gọi 115.\n"
                "- KHÔNG chẩn đoán thay bác sĩ, chỉ tư vấn phòng ngừa.\n"
                "- Giọng điệu: ấm áp, dễ tiếp cận, như bác sĩ thực thụ.\n"
                "- CHỈ TRẢ LỜI CHI TIẾT - không kèm ghi chú hay template."
            )

        # Tạo full prompt
        full_prompt = f"{system_prompt}\n\nCâu hỏi từ bệnh nhân: {message_text}"
        print(f"[DEBUG] Full prompt length: {len(full_prompt)} chars")

        # Gọi Gemini API với xử lý lỗi chi tiết
        try:
            print(f"[DEBUG] Calling Gemini model...")
            response = gemini_model.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=2000,
                    temperature=0.8,
                )
            )
            print(f"[DEBUG] Gemini response received")

            if not response or not response.text:
                raise ValueError("Gemini trả về response trống")

            reply = response.text
            print(f"[DEBUG] Reply length: {len(reply)} chars")

        except Exception as gemini_err:
            error_msg = f"Lỗi gọi Gemini API: {str(gemini_err)}"
            print(f"[ERROR] {error_msg}")
            print(f"[ERROR] Exception type: {type(gemini_err).__name__}")
            print(f"[ERROR] Full traceback: {gemini_err}")
            
            return JSONResponse(
                status_code=500,
                content={
                    "detail": f"Máy chủ AI gặp lỗi: {str(gemini_err)}",
                    "error_type": type(gemini_err).__name__
                }
            )

        # Lưu vào database
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            cursor.execute(
                "INSERT INTO chat_logs (user_id, user_message, ai_response) VALUES (%s, %s, %s)",
                (user_id, message_text, reply),
            )
            conn.commit()
            print(f"[INFO] Chat saved - User {user_id}: {message_text[:50]}...")

        except Exception as db_err:
            error_msg = f"Lỗi lưu database: {str(db_err)}"
            print(f"[ERROR] {error_msg}")
            return JSONResponse(
                status_code=500,
                content={
                    "detail": f"Lỗi lưu lịch sử: {str(db_err)}",
                    "error_type": type(db_err).__name__
                }
            )

        # Trả về response thành công
        return {
            "reply": reply,
            "chat_type": chat_type,
            "timestamp": datetime.now().isoformat(),
        }

    except HTTPException:
        raise
    except Exception as e:
        error_msg = f"Lỗi không xác định trong chat handler: {str(e)}"
        print(f"[ERROR] {error_msg}")
        print(f"[ERROR] Exception type: {type(e).__name__}")
        
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Lỗi máy chủ: {str(e)}",
                "error_type": type(e).__name__
            }
        )

    finally:
        if conn and conn.is_connected():
            try:
                cursor.close()
                conn.close()
            except:
                pass


# ============================================================================
# ENDPOINT: GET /api/chat/logs/{user_id} - Lịch sử tư vấn AI
# ============================================================================
@app.get("/api/chat/logs/{user_id}")
def get_chat_logs(user_id: int, limit: int = 30):
    """Lấy lịch sử chat gần đây của user."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT chat_id, user_message, ai_response, created_at
            FROM chat_logs
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT %s
            """,
            (user_id, min(limit, 50)),
        )
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get("created_at"), datetime):
                row["created_at"] = row["created_at"].isoformat()
        return list(reversed(rows))
    except Exception as e:
        print(f"[ERROR] Chat logs error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử chat: {str(e)}")
    finally:
        if "conn" in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: GET /api/history/{user_id} - Lấy lịch sử đo khám
# ============================================================================
@app.get("/api/history/{user_id}")
def get_history(user_id: int):
    """
    Lấy lịch sử đo khám của user
    - Trả về 20 bản ghi gần nhất
    - Dùng để vẽ biểu đồ lịch sử
    """
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)

        cursor.execute(
            """
            SELECT record_id, HighBP, HighChol, BMI, Smoker, Diabetes,
                   PhysActivity, Fruits, Veggies, HvyAlcoholConsump,
                   Age, Sex, risk_percentage, risk_level, is_anomaly, created_at
            FROM health_records
            WHERE user_id = %s
            ORDER BY created_at DESC
            LIMIT 20
            """,
            (user_id,)
        )

        records = cursor.fetchall()

        # Convert datetime to string
        for record in records:
            if isinstance(record.get("created_at"), datetime):
                record["created_at"] = record["created_at"].isoformat()

        return list(reversed(records))

    except Exception as e:
        print(f"[ERROR] History error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử: {str(e)}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: POST /api/analyze-video-speech - Phân tích giọng nói từ video
# ============================================================================
@app.post("/api/analyze-video-speech")
async def analyze_video_speech(file: UploadFile = File(...)):
    """Phân tích giọng nói từ video bằng Gemini."""
    require_gemini()

    temp_filename = f"{uuid.uuid4()}.webm"
    temp_path = os.path.join(tempfile.gettempdir(), temp_filename)

    try:
        content = await file.read()
        with open(temp_path, "wb") as f:
            f.write(content)

        # Upload file lên Gemini
        print(f"[FAST] Đang upload video lên Gemini để phân tích giọng nói: {temp_filename}")
        gemini_file = genai.upload_file(path=temp_path)

        # Gọi mô hình với video file
        prompt = (
            "Bạn là một chuyên gia nhận diện giọng nói. Hãy nghe đoạn âm thanh trong video này và "
            "trích xuất ra chính xác những gì người trong video đang nói bằng Tiếng Việt. "
            "Nếu bạn không nghe thấy bất kỳ tiếng người nào, hãy trả về chữ 'EMPTY'. "
            "Chỉ trả về câu nói, không giải thích gì thêm."
        )

        response = gemini_model.generate_content([gemini_file, prompt])
        transcript = response.text.strip()

        # Cleanup file trên máy chủ Gemini
        genai.delete_file(gemini_file.name)

        if transcript.upper() == "EMPTY":
            transcript = ""

        print(f"[FAST] Gemini Speech Transcript: {transcript}")
        return {"transcript": transcript}

    except Exception as e:
        print(f"[ERROR] Analyze Video Speech error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi AI phân tích giọng nói: {str(e)}")
    finally:
        # Xóa file tạm trên ổ cứng
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except:
                pass

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
