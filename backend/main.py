# GHI CHÚ VẤN ĐÁP:
# File này là backend trung tâm của hệ thống SmartHealthcare.
# Vai trò chính:
# - Khởi tạo FastAPI, CORS, kết nối database MySQL và load các mô hình AI/ML.
# - Cung cấp API cho frontend React: đăng ký, đăng nhập, dự đoán nguy cơ,
#   tư vấn AI, phân tích dinh dưỡng, FAST/SOS, lịch sử sức khỏe và email khẩn cấp.
# - Các thuật toán/dịch vụ chính nằm trong file này gồm:
#   Random Forest để dự đoán nguy cơ tim mạch/đột quỵ,
#   Isolation Forest để phát hiện dữ liệu bất thường,
#   Gemini/OpenRouter/Groq để sinh tư vấn y tế và phân tích ảnh khẩn cấp.
# Khi thầy hỏi công thức y = f(X) + b:
# - Với /api/predict: X là 11 chỉ số sức khỏe, f là Random Forest, y là phần trăm nguy cơ.
# - Với anomaly: X là 11 chỉ số sức khỏe, f là Isolation Forest, y là is_anomaly.
# - Với chat/dinh dưỡng/cấp cứu: X là câu hỏi, mô tả hoặc ảnh; f là LLM/Vision AI; y là phản hồi tư vấn.

 # FastAPI Backend - SmartPreventiveHealth
# Nền tảng AI Phòng Chống Bệnh Tim mạch & Đột quỵ Toàn Lứa Tuổi
# Các endpoints: /api/register, /api/login, /api/predict, /api/chat, /api/history, /api/health

import os
import sys
import base64
import html
import io
import secrets
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
import jwt
import pandas as pd
import mysql.connector
from datetime import datetime, timedelta, timezone
from typing import Optional
from fastapi import FastAPI, HTTPException, UploadFile, File, Depends
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel
import google.generativeai as genai
import tempfile
import uuid
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load biến môi trường từ file .env
load_dotenv(os.path.join(BASE_DIR, ".env"))

# Load thêm file .env từ frontend nếu có để lấy GROQ API key
try:
    frontend_env_path = os.path.join(BASE_DIR, "..", "frontend", ".env")
    if os.path.exists(frontend_env_path):
        load_dotenv(frontend_env_path)
        print(f"[INFO] Đã load bổ sung file .env từ frontend: {frontend_env_path}")
except Exception as env_err:
    print(f"[WARN] Không thể load frontend/.env: {env_err}")


# Khởi tạo FastAPI app
app = FastAPI(
    title="SmartPreventiveHealth",
    description="Nền tảng AI Phòng Chống Bệnh Tim mạch & Đột quỵ - Toàn Lứa Tuổi",
    version="2.0.0"
)

# Cấu hình CORS - hỗ trợ cấu hình qua ALLOWED_ORIGINS khi deploy
_raw_origins = os.getenv("ALLOWED_ORIGINS", "*").strip()
_allowed_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()] or ["*"]
_allow_credentials = "*" not in _allowed_origins

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=_allow_credentials,
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
    rf_model_path = os.path.join(BASE_DIR, "heart_risk_model.pkl")
    iso_model_path = os.path.join(BASE_DIR, "anomaly_detector.pkl")

    if os.path.exists(rf_model_path):
        rf_model = joblib.load(rf_model_path)
        MODEL_LOADED = True
        print("✓ Mô hình Heart Risk Random Forest đã tải thành công!")
    
    if os.path.exists(iso_model_path):
        iso_forest = joblib.load(iso_model_path)
        print("✓ Mô hình Anomaly Detector (Isolation Forest) đã tải thành công!")
except Exception as e:
    print(f"✗ Lỗi load model: {e}")
    MODEL_LOADED = False

# ============================================================================
# 2. KHỞI TẠO GEMINI CLIENT - Hỗ trợ NHIỀU API KEY với auto-fallback
# ============================================================================

class GeminiManager:
    """
    Quản lý nhiều Gemini API key với tự động chuyển key khi hết quota.
    - Khi key hiện tại bị 429 / RESOURCE_EXHAUSTED → tự chuyển sang key tiếp theo
    - Hỗ trợ cả text-only và vision (multimodal)
    """

    def __init__(self, api_keys: list[str], model_name: str = 'gemini-2.5-flash'):
        self.api_keys = [k.strip() for k in api_keys if k.strip()]
        self.model_name = model_name
        self.current_index = 0
        self._models = {}  # cache model per key

        if not self.api_keys:
            print("❌ LỖI NGHIÊM TRỌNG: Không có GEMINI API KEY nào!")
            return

        # Khởi tạo model cho key đầu tiên
        self._init_key(0)

    def _init_key(self, index: int):
        """Khởi tạo Gemini model cho key tại index"""
        if index >= len(self.api_keys):
            return None
        key = self.api_keys[index]
        try:
            genai.configure(api_key=key)
            model = genai.GenerativeModel(self.model_name)
            self._models[index] = model
            self.current_index = index
            key_preview = key[:15] + "..." + key[-4:]
            print(f"✅ Gemini key #{index + 1}/{len(self.api_keys)} đã sẵn sàng: {key_preview}")
            return model
        except Exception as e:
            print(f"❌ Lỗi khởi tạo Gemini key #{index + 1}: {e}")
            return None

    def _switch_to_next_key(self) -> bool:
        """Chuyển sang key tiếp theo. Trả về True nếu còn key."""
        next_idx = self.current_index + 1
        if next_idx >= len(self.api_keys):
            print(f"⚠️ Đã dùng hết tất cả {len(self.api_keys)} API key!")
            return False
        print(f"🔄 Chuyển sang Gemini API key #{next_idx + 1}/{len(self.api_keys)}...")
        model = self._init_key(next_idx)
        return model is not None

    def _is_quota_error(self, e: Exception) -> bool:
        """Kiểm tra lỗi 429 / RESOURCE_EXHAUSTED từ Gemini API."""
        msg = str(e).lower()
        return "429" in msg or "resource_exhausted" in msg or "quota" in msg or "rate limit" in msg

    @property
    def model(self):
        """Trả về model hiện tại"""
        return self._models.get(self.current_index)

    @property
    def is_available(self) -> bool:
        return bool(self.api_keys) and self.model is not None

    def generate_content(self, contents, generation_config=None, max_retries=None):
        """
        Gọi Gemini generate_content với auto-fallback key.
        - contents: str hoặc list (multimodal)
        - generation_config: GenerationConfig
        - Tự động chuyển key khi gặp lỗi quota
        """
        if not self.is_available:
            raise Exception("Gemini API chưa cấu hình. Thêm GEMINI_API_KEYS vào backend/.env")

        if max_retries is None:
            max_retries = len(self.api_keys)

        last_error = None
        for attempt in range(max_retries):
            try:
                model = self.model
                if model is None:
                    if not self._switch_to_next_key():
                        break
                    model = self.model

                # Cấu hình lại API key trước mỗi lần gọi (đảm bảo đúng key)
                genai.configure(api_key=self.api_keys[self.current_index])

                if generation_config:
                    response = model.generate_content(contents, generation_config=generation_config)
                else:
                    response = model.generate_content(contents)
                return response

            except Exception as e:
                last_error = e
                if self._is_quota_error(e):
                    print(f"⚠️ Key #{self.current_index + 1} hết quota: {str(e)[:80]}")
                    if not self._switch_to_next_key():
                        break  # Hết key rồi
                    continue  # Thử key mới
                else:
                    raise  # Lỗi khác (không phải quota) → throw ngay

        # Tất cả key đều hết quota
        raise last_error or Exception("Tất cả Gemini API key đều đã hết quota!")

# --- Khởi tạo GeminiManager ---
print("\n[INFO] Khởi tạo Gemini API (multi-key fallback)...")

# Đọc danh sách key: ưu tiên GEMINI_API_KEYS (nhiều key), fallback GEMINI_API_KEY (1 key)
_raw_keys = os.getenv("GEMINI_API_KEYS", "") or os.getenv("GEMINI_API_KEY", "")
_key_list = [k.strip() for k in _raw_keys.split(",") if k.strip()]

if not _key_list:
    print("❌ LỖI: Không tìm thấy GEMINI_API_KEY(S) trong file .env!")
    print("   Giải pháp: Thêm GEMINI_API_KEYS=key1,key2 vào backend/.env")
    gemini_mgr = None
    gemini_model = None
else:
    print(f"[INFO] Tìm thấy {len(_key_list)} API key(s)")
    gemini_mgr = GeminiManager(api_keys=_key_list)
    gemini_model = gemini_mgr  # Backward compatibility: gemini_model giờ là GeminiManager

print("\n" + "="*80)
print()

# ============================================================================
# 3. DATABASE CONNECTION POOL (tái sử dụng connection, giảm latency)
# ============================================================================
from mysql.connector import pooling

_db_pool = None

def _get_pool():
    global _db_pool
    if _db_pool is None:
        _db_pool = pooling.MySQLConnectionPool(
            pool_name="healthcare_pool",
            pool_size=5,
            pool_reset_session=True,
            host=os.getenv("DB_HOST", "localhost"),
            port=int(os.getenv("DB_PORT", "3306")),
            user=os.getenv("DB_USER", "root"),
            password=os.getenv("DB_PASSWORD", ""),
            database=os.getenv("DB_NAME", "healthcare_db")
        )
    return _db_pool

# ============================================================================
# JWT AUTHENTICATION HELPERS
# ============================================================================
JWT_SECRET = os.getenv("JWT_SECRET") or secrets.token_urlsafe(32)
JWT_ALGORITHM = "HS256"
JWT_EXPIRE_HOURS = int(os.getenv("JWT_EXPIRE_HOURS", "168"))  # 7 ngày mặc định
_bearer_scheme = HTTPBearer(auto_error=False)


def create_access_token(user_id: int, email: str, full_name: str) -> str:
    """Tạo JWT access token cho phiên đăng nhập."""
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "user_id": int(user_id),
        "email": email,
        "full_name": full_name,
        "iat": now,
        "exp": now + timedelta(hours=JWT_EXPIRE_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(_bearer_scheme),
) -> dict:
    """Xác thực Bearer JWT token cho các endpoint cần đăng nhập."""
    if not credentials or credentials.scheme.lower() != "bearer":
        raise HTTPException(status_code=401, detail="Vui lòng đăng nhập lại (thiếu token xác thực).")
    try:
        payload = jwt.decode(credentials.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return {
            "user_id": int(payload["user_id"]),
            "email": payload.get("email", ""),
            "full_name": payload.get("full_name", ""),
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.")
    except Exception:
        raise HTTPException(status_code=401, detail="Token xác thực không hợp lệ. Vui lòng đăng nhập lại.")

def get_db_connection():
    """Lấy kết nối từ connection pool (nhanh hơn so với tạo mới mỗi lần)"""
    try:
        pool = _get_pool()
        return pool.get_connection()
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
    session_id: Optional[str] = None

class HealthAdviceRequest(BaseModel):
    """Schema for AI health advice after risk assessment"""
    risk_percentage: float
    health_data: dict

class MealRequest(BaseModel):
    """Schema for meal analysis (text + optional image)"""
    description: str = ""
    image_base64: str = ""
    image_name: Optional[str] = ""

class EmergencyRequest(BaseModel):
    """Schema for emergency alert diagnosis (image-based)"""
    image_base64: str
    alert_type: str  # "Face Asymmetry" (Méo miệng) hoặc "Fall Detection" (Té ngã)
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None

class EmergencyEmailRequest(BaseModel):
    """Schema for emergency SOS email sending"""
    user_id: Optional[int] = None
    receiver_email: str
    user_name: Optional[str] = None
    latitude: float
    longitude: float
    address: Optional[str] = ""
    hospitals: Optional[list] = []

class HeartRateAdviceRequest(BaseModel):
    """Schema for heart-rate anomaly advice (text-only, no image)"""
    bpm: int
    duration_seconds: Optional[int] = None  # Số giây BPM đã duy trì ở mức bất thường


# ============================================================================
# GEMINI HELPERS
# ============================================================================
MAX_IMAGE_BASE64_LEN = 10 * 1024 * 1024  # ~10MB encoded (hỗ trợ ảnh ~7-8MB)


def require_gemini():
    has_gemini = gemini_mgr is not None and gemini_mgr.is_available
    has_groq = bool(os.getenv("GROQ_API_KEY", "") or os.getenv("VITE_GROQ_API_KEY", ""))
    has_openrouter = bool(os.getenv("OPENROUTER_API_KEY", ""))
    if has_gemini or has_groq or has_openrouter:
        return
    raise HTTPException(
        status_code=503,
        detail="Chưa cấu hình AI API key. Thêm GEMINI_API_KEYS, OPENROUTER_API_KEY hoặc GROQ_API_KEY vào backend/.env.",
    )


def generate_text_with_fallback(
    prompt: str,
    system_prompt: Optional[str] = None,
    max_tokens: int = 2000,
    temperature: float = 0.7,
) -> str:
    """Sinh văn bản AI theo thứ tự ưu tiên: Gemini -> OpenRouter -> Groq."""
    last_err = None
    full_prompt = f"{system_prompt}\n\n{prompt}" if system_prompt else prompt

    # 1. Gemini
    if gemini_mgr is not None and gemini_mgr.is_available:
        try:
            response = gemini_mgr.generate_content(
                full_prompt,
                generation_config=genai.types.GenerationConfig(
                    max_output_tokens=max_tokens,
                    temperature=temperature,
                ),
            )
            if response and getattr(response, "text", None):
                return response.text.strip()
        except Exception as e:
            last_err = e
            print(f"[WARN] Gemini text fallback triggered: {e}")

    # 2. OpenRouter
    openrouter_api_key = os.getenv("OPENROUTER_API_KEY", "")
    if openrouter_api_key:
        for model_name in [
            "google/gemma-4-31b-it:free",
            "google/gemma-4-26b-a4b-it:free",
            "nvidia/nemotron-3.5-lightning:free",
        ]:
            try:
                reply = call_openrouter_api(
                    prompt=prompt,
                    system_prompt=system_prompt,
                    base64_image=None,
                    model=model_name,
                )
                if reply:
                    return reply
            except Exception as e:
                last_err = e
                print(f"[WARN] OpenRouter ({model_name}) failed: {e}")

    # 3. Groq
    groq_api_key = os.getenv("GROQ_API_KEY", "") or os.getenv("VITE_GROQ_API_KEY", "")
    if groq_api_key:
        from groq import Groq
        groq_client = Groq(api_key=groq_api_key)
        messages = []
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})
        messages.append({"role": "user", "content": prompt})
        for groq_model in ["llama-3.1-8b-instant", "llama-3.3-70b-versatile"]:
            try:
                groq_response = groq_client.chat.completions.create(
                    model=groq_model,
                    messages=messages,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                content = groq_response.choices[0].message.content
                if content:
                    return content.strip()
            except Exception as e:
                last_err = e
                print(f"[WARN] Groq ({groq_model}) fallback failed: {e}")

    raise last_err or RuntimeError("Tất cả nhà cung cấp AI đều không khả dụng.")



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
        salt = bcrypt.gensalt(rounds=10)
        hashed_pw = bcrypt.hashpw(req.password.encode('utf-8'), salt).decode('utf-8')

        # Thêm user mới vào DB
        cursor.execute(
            "INSERT INTO users (full_name, email, password_hash) VALUES (%s, %s, %s)",
            (req.full_name, req.email, hashed_pw)
        )
        conn.commit()
        user_id = cursor.lastrowid

        print(f"[INFO] User mới đã đăng ký: {req.email} (ID: {user_id})")
        token = create_access_token(user_id=user_id, email=req.email, full_name=req.full_name)

        return {
            "success": True,
            "user_id": user_id,
            "full_name": req.full_name,
            "access_token": token,
            "token_type": "bearer",
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
# ENDPOINT: POST /api/login - Đăng nhập (tối ưu tốc độ)
# ============================================================================
import asyncio
import concurrent.futures

_bcrypt_executor = concurrent.futures.ThreadPoolExecutor(max_workers=4, thread_name_prefix="bcrypt")
_TARGET_BCRYPT_ROUNDS = 10  # rounds=10 ~ 0.6s, rounds=12 ~ 2.4s

@app.post("/api/login")
async def login(req: LoginRequest):
    """
    Đăng nhập - xác thực email/password
    - Verify bcrypt hash (chạy trong thread pool, không block event loop)
    - Tự động re-hash password nếu hash cũ dùng rounds cao (12 → 10)
    - Trả về user_id và full_name
    """
    import time
    t0 = time.perf_counter()

    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        t1 = time.perf_counter()

        # Lấy user từ email
        cursor.execute(
            "SELECT user_id, full_name, password_hash FROM users WHERE email=%s",
            (req.email,)
        )
        user = cursor.fetchone()
        t2 = time.perf_counter()

        if not user:
            raise HTTPException(status_code=400, detail="Sai email hoặc mật khẩu!")

        # Chạy bcrypt.checkpw trong thread pool để không block async event loop
        loop = asyncio.get_event_loop()
        pw_ok = await loop.run_in_executor(
            _bcrypt_executor,
            bcrypt.checkpw,
            req.password.encode('utf-8'),
            user['password_hash'].encode('utf-8')
        )
        t3 = time.perf_counter()

        if not pw_ok:
            raise HTTPException(status_code=400, detail="Sai email hoặc mật khẩu!")

        # --- Tự động re-hash nếu hash cũ dùng rounds cao hơn target ---
        # bcrypt hash format: $2b$<rounds>$...
        stored_hash = user['password_hash']
        try:
            current_rounds = int(stored_hash.split('$')[2])
            if current_rounds > _TARGET_BCRYPT_ROUNDS:
                new_salt = bcrypt.gensalt(rounds=_TARGET_BCRYPT_ROUNDS)
                new_hash = await loop.run_in_executor(
                    _bcrypt_executor,
                    bcrypt.hashpw,
                    req.password.encode('utf-8'),
                    new_salt
                )
                cursor.execute(
                    "UPDATE users SET password_hash=%s WHERE user_id=%s",
                    (new_hash.decode('utf-8'), user['user_id'])
                )
                conn.commit()
                print(f"[OPT] Re-hashed password for user {user['user_id']}: rounds {current_rounds} → {_TARGET_BCRYPT_ROUNDS}")
        except Exception as rehash_err:
            # Không ảnh hưởng login nếu re-hash thất bại
            print(f"[WARN] Re-hash failed: {rehash_err}")

        print(f"[INFO] Login OK: {req.email} (ID: {user['user_id']}) | DB: {(t2-t1)*1000:.0f}ms | bcrypt: {(t3-t2)*1000:.0f}ms | total: {(time.perf_counter()-t0)*1000:.0f}ms")
        token = create_access_token(user_id=user["user_id"], email=req.email, full_name=user["full_name"])

        return {
            "success": True,
            "user_id": user["user_id"],
            "full_name": user["full_name"],
            "access_token": token,
            "token_type": "bearer",
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
def compute_feature_contributions(importances: dict, req: PredictRequest) -> dict:
    """
    Tính đóng góp XAI theo từng bệnh nhân (kết hợp độ quan trọng của Random Forest
    với chiều hướng thực tế của từng chỉ số: >0 tăng nguy cơ, <0 bảo vệ/giảm nguy cơ).
    """
    signs = {
        "HighBP": 1 if req.HighBP == 1 else -1,
        "HighChol": 1 if req.HighChol == 1 else -1,
        "BMI": 1 if (req.BMI >= 25 or req.BMI < 18.5) else -1,
        "Smoker": 1 if req.Smoker == 1 else -1,
        "Diabetes": 1 if req.Diabetes >= 1 else -1,
        "PhysActivity": -1 if req.PhysActivity == 1 else 1,
        "Fruits": -1 if req.Fruits == 1 else 1,
        "Veggies": -1 if req.Veggies == 1 else 1,
        "HvyAlcoholConsump": 1 if req.HvyAlcoholConsump == 1 else -1,
        "Age": 1 if req.Age >= 8 else -1,
        "Sex": 1 if req.Sex == 1 else -0.5,
    }
    return {
        name: round(float(imp) * signs.get(name, 1), 6)
        for name, imp in importances.items()
    }


@app.post("/api/predict")
def predict_risk(req: PredictRequest, current_user: dict = Depends(get_current_user)):
    """
    Dự đoán rủi ro Tim mạch & Đột quỵ
    - Load model từ .pkl file
    - Predict xác suất risk
    - Lưu kết quả vào health_records
    - Phân loại risk level: Thấp (<30%), Trung bình (30-60%), Cao (>60%)
    """
    if req.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Không có quyền thực hiện dự đoán cho người dùng khác.")

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

        # Feature Importance & per-patient Contributions for XAI
        importances = {}
        contributions = {}
        if rf_model is not None:
            feature_names = [
                'HighBP', 'HighChol', 'BMI', 'Smoker', 'Diabetes', 'PhysActivity', 
                'Fruits', 'Veggies', 'HvyAlcoholConsump', 'Age', 'Sex'
            ]
            for i, name in enumerate(feature_names):
                importances[name] = float(rf_model.feature_importances_[i])
            contributions = compute_feature_contributions(importances, req)

        print(f"[INFO] Health record saved - User {req.user_id}: Risk {risk_prob:.2f}% ({risk_level})")

        return {
            "risk_percentage": round(risk_prob, 2),
            "risk_level": risk_level,
            "is_anomaly": is_anomaly,
            "message": message,
            "feature_importances": importances,
            "feature_contributions": contributions,
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
    """Tạo 3 gạch đầu dòng lời khuyên từ AI (Gemini -> OpenRouter -> Groq -> dự phòng)."""
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
        advice = generate_text_with_fallback(
            prompt=user_prompt,
            system_prompt=system_prompt,
            max_tokens=300,
            temperature=0.7,
        )
        return {"advice": advice}
    except Exception as e:
        print(f"[WARN] Health advice AI fallback to static: {e}")
        risk = req.risk_percentage
        if risk >= 60:
            advice = (
                "• Hạn chế tối đa các thực phẩm nhiều muối, mỡ động vật và đồ ăn chế biến sẵn.\n"
                "• Đo huyết áp và nhịp tim hàng ngày, uống thuốc đúng giờ theo chỉ định của bác sĩ.\n"
                "• Tránh làm việc quá sức, giữ tinh thần thoải mái và liên hệ ngay cơ sở y tế khi có dấu hiệu bất thường."
            )
        elif risk >= 30:
            advice = (
                "• Tăng cường ăn rau xanh, trái cây tươi và các loại ngũ cốc nguyên hạt hàng ngày.\n"
                "• Dành ít nhất 30 phút mỗi ngày để đi bộ nhẹ nhàng hoặc tập thể dục vừa sức.\n"
                "• Kiểm tra sức khỏe định kỳ mỗi 6 tháng để theo dõi sát sao các chỉ số tim mạch."
            )
        else:
            advice = (
                "• Duy trì chế độ ăn uống cân bằng, uống đủ nước và ngủ đủ giấc từ 7-8 tiếng mỗi đêm.\n"
                "• Tập thể dục đều đặn ít nhất 5 ngày mỗi tuần để duy trì độ dẻo dai cho tim mạch.\n"
                "• Tránh xa khói thuốc lá và hạn chế tối đa việc sử dụng đồ uống có cồn."
            )
        return {"advice": advice}

# ============================================================================
# ENDPOINT: POST /api/analyze-meal - Phân tích bữa ăn (text + ảnh)
# ============================================================================
@app.post("/api/analyze-meal")
def analyze_meal(req: MealRequest):
    """Phân tích dinh dưỡng bằng duy nhất OpenRouter (hỗ trợ mô tả văn bản và ảnh món ăn)."""
    description = (req.description or "").strip()
    base64_data = (req.image_base64 or "").strip()
    
    # Làm sạch chuỗi Base64 (cắt bỏ phần prefix data:image/...;base64,)
    if "," in base64_data:
        base64_data = base64_data.split(",")[1]

    has_image = bool(base64_data)

    if not description and not has_image:
        raise HTTPException(status_code=400, detail="Vui lòng nhập mô tả hoặc tải ảnh bữa ăn.")

    # === OFFLINE MOCK MODE FOR DEMO/PRESENTATION ===
    import time
    desc_clean = description.lower().replace("_", " ").replace("-", " ")
    img_name_clean = (req.image_name or "").lower().replace("_", " ").replace("-", " ")

    # Hàm loại bỏ dấu tiếng Việt cơ bản để so khớp không dấu
    def strip_vietnamese_accents(s):
        import unicodedata
        s = s.replace("đ", "d").replace("Đ", "d")
        nfkd_form = unicodedata.normalize('NFKD', s)
        return "".join([c for c in nfkd_form if not unicodedata.combining(c)])

    desc_no_accent = strip_vietnamese_accents(desc_clean)
    img_name_no_accent = strip_vietnamese_accents(img_name_clean)

    def match_keyword(kw_list):
        for kw in kw_list:
            kw_clean = kw.lower()
            kw_no_accent = strip_vietnamese_accents(kw_clean)
            # Kiểm tra khớp nguyên bản
            if kw_clean in desc_clean or kw_clean in img_name_clean:
                return True
            # Kiểm tra khớp không dấu
            if kw_no_accent in desc_no_accent or kw_no_accent in img_name_no_accent:
                return True
        return False

    mock_reply = None
    mock_food_type = None

    if match_keyword(["cơm gà", "com ga"]):
        mock_food_type = "Cơm Gà"
        mock_reply = (
            "### PHÂN TÍCH BỮA ĂN\n"
            "Bữa ăn: Cơm gà (gồm cơm nấu nước dùng gà, thịt gà luộc/xé, dưa leo, hành ngò).\n\n"
            "### THÀNH PHẦN DINH DƯỠNG (ước lượng cho 1 đĩa 400g):\n"
            "- Calo: 680 kcal\n"
            "- Đạm (Protein): 36 g\n"
            "- Chất béo (Fat): 18 g (Chất béo bão hòa: 5 g)\n"
            "- Tinh bột (Carb): 85 g (Đường: 2 g)\n"
            "- Muối (Sodium): 980 mg\n"
            "- Chất xơ: 1.5 g\n\n"
            "### ĐÁNH GIÁ TÁC ĐỘNG TIM MẠCH:\n"
            "Mức độ: TRUNG BÌNH\n"
            "Giải thích: Món ăn này cung cấp protein dồi dào từ gà. Tuy nhiên cơm gà nấu bằng mỡ gà làm tăng chất béo bão hòa. Nước mắm gừng hoặc súp ăn kèm chứa lượng muối khá cao, có thể ảnh hưởng đến huyết áp nếu tiêu thụ thường xuyên.\n\n"
            "### 4. LỜI KHUYÊN THỰC TIỄN từ Bác Sĩ AI:\n"
            "- Ưu tiên ăn phần thịt ức gà bỏ da để giảm chất béo bão hòa.\n"
            "- Hạn chế chan quá nhiều nước mắm gừng hoặc nước súp đi kèm để giảm lượng muối nạp vào cơ thể.\n"
            "- Ăn thêm dưa leo, rau xà lách đi kèm để bổ sung chất xơ lành mạnh giúp giảm hấp thu mỡ xấu.\n"
            "- Giảm bớt lượng cơm ăn vào nếu bạn đang kiểm soát cân nặng hoặc đường huyết."
        )
    elif match_keyword(["bún bò", "bun bo"]):
        mock_food_type = "Bún Bò"
        mock_reply = (
            "### PHÂN TÍCH BỮA ĂN\n"
            "Bữa ăn: Bún bò (gồm bún, thịt bò nạm/gân, nước dùng hầm xương heo/bò có sả và sa tế).\n\n"
            "### THÀNH PHẦN DINH DƯỠNG (ước lượng cho 1 tô lớn 600g):\n"
            "- Calo: 620 kcal\n"
            "- Đạm (Protein): 30 g\n"
            "- Chất béo (Fat): 20 g (Chất béo bão hòa: 6.5 g)\n"
            "- Tinh bột (Carb): 65 g (Đường: 3 g)\n"
            "- Muối (Sodium): 1500 mg\n"
            "- Chất xơ: 2.0 g\n\n"
            "### ĐÁNH GIÁ TÁC ĐỘNG TIM MẠCH:\n"
            "Mức độ: CÓ RỦI RO\n"
            "Giải thích: Lượng muối (sodium) trong một tô bún bò rất cao, chiếm gần 75% lượng khuyến nghị hàng ngày. Chất béo bão hòa từ nước béo và mỡ nạm bò cũng tăng áp lực lên hệ tim mạch, tăng nguy cơ mỡ máu (cholesterol xấu).\n\n"
            "### 4. LỜI KHUYÊN THỰC TIỄN từ Bác Sĩ AI:\n"
            "- Không nên húp hết nước dùng của tô bún bò để giảm thiểu tối đa lượng muối nạp vào.\n"
            "- Yêu cầu người bán không thêm nước béo hoặc dầu sa tế đỏ lên bề mặt tô bún.\n"
            "- Ăn kèm thật nhiều rau sống (bắp chuối, rau muống chẻ, giá đỗ) để bổ sung chất xơ và kali giúp trung hòa bớt muối.\n"
            "- Chọn thịt bò nạc thay vì thịt nạm béo nhiều mỡ bão hòa."
        )
    elif match_keyword(["ức gà", "uc ga"]):
        mock_food_type = "Ức Gà"
        mock_reply = (
            "### PHÂN TÍCH BỮA ĂN\n"
            "Bữa ăn: Ức gà (ức gà áp chảo/luộc kèm súp lơ xanh hoặc rau củ luộc).\n\n"
            "### THÀNH PHẦN DINH DƯỠNG (ước lượng cho 1 phần 250g):\n"
            "- Calo: 290 kcal\n"
            "- Đạm (Protein): 45 g\n"
            "- Chất béo (Fat): 4 g (Chất béo bão hòa: 1.0 g)\n"
            "- Tinh bột (Carb): 8 g (Đường: 1 g)\n"
            "- Muối (Sodium): 180 mg\n"
            "- Chất xơ: 3.0 g\n\n"
            "### ĐÁNH GIÁ TÁC ĐỘNG TIM MẠCH:\n"
            "Mức độ: TUYỆT VỜI\n"
            "Giải thích: Ức gà là nguồn đạm nạc hoàn hảo, cực kỳ ít chất béo bão hòa và cholesterol xấu. Món ăn này khi chế biến thanh đạm giúp bảo vệ thành mạch máu, kiểm soát huyết áp và hỗ trợ giảm mỡ máu cực tốt.\n\n"
            "### 4. LỜI KHUYÊN THỰC TIỄN từ Bác Sĩ AI:\n"
            "- Tiếp tục duy trì món ăn này trong chế độ ăn hàng tuần của bạn.\n"
            "- Nên kết hợp áp chảo với các loại dầu thực vật tốt cho tim mạch như dầu ô liu hoặc dầu hướng dương với lượng vừa phải.\n"
            "- Tránh sử dụng quá nhiều gia vị muối hoặc nước sốt chế biến sẵn có nhiều đường và muối.\n"
            "- Đa dạng hóa các loại rau củ luộc ăn kèm để tăng hàm lượng vitamin và chất xơ."
        )
    elif match_keyword(["cải thìa", "cai thia"]):
        mock_food_type = "Cải Thìa Luộc"
        mock_reply = (
            "### PHÂN TÍCH BỮA ĂN\n"
            "Bữa ăn: Cải thìa luộc thanh đạm.\n\n"
            "### THÀNH PHẦN DINH DƯỠNG (ước lượng cho 1 đĩa 150g):\n"
            "- Calo: 30 kcal\n"
            "- Đạm (Protein): 2 g\n"
            "- Chất béo (Fat): 0.2 g (Chất béo bão hòa: 0 g)\n"
            "- Tinh bột (Carb): 4.5 g (Đường: 1.2 g)\n"
            "- Muối (Sodium): 45 mg\n"
            "- Chất xơ: 2.2 g\n\n"
            "### ĐÁNH GIÁ TÁC ĐỘNG TIM MẠCH:\n"
            "Mức độ: TUYỆT VỜI\n"
            "Giải thích: Rau xanh chứa hàm lượng Kali và chất xơ dồi dào giúp đào thải Natri dư thừa, hạ huyết áp hiệu quả. Cải thìa hoàn toàn không có chất béo xấu và chứa nhiều chất chống oxy hóa bảo vệ tim mạch khỏi các gốc tự do có hại.\n\n"
            "### 4. LỜI KHUYÊN THỰC TIỄN từ Bác Sĩ AI:\n"
            "- Đây là món ăn kèm lý tưởng cho bất kỳ bữa ăn chính nào trong ngày.\n"
            "- Nên ăn ngay sau khi luộc chín tới để giữ được trọn vẹn vitamin C và các khoáng chất.\n"
            "- Khi ăn, tránh chấm kèm với các loại nước chấm quá mặn (như nước tương, nước mắm tỏi ớt nguyên chất) mà nên pha loãng.\n"
            "- Có thể kết hợp luộc cùng các loại nấm tươi để tăng thêm hương vị và bổ sung chất đạm thực vật lành tính."
        )

    if mock_reply and os.getenv("ENABLE_DEMO_MOCK", "false").lower() == "true":
        print(f"[DEMO MODE] Phát hiện món ăn demo '{mock_food_type}' qua từ khóa mô tả hoặc tên ảnh.")
        return {
            "reply": mock_reply,
            "has_image": has_image,
            "timestamp": datetime.now().isoformat(),
        }

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
        reply = None
        last_err = None

        if has_image:
            if len(base64_data) > (MAX_IMAGE_BASE64_LEN * 1.5): # Dự phòng size
                raise HTTPException(status_code=400, detail="Ảnh quá lớn. Vui lòng chọn ảnh nhỏ hơn 4MB.")

            prompt_text = (
                f"{system_prompt}\n\nHãy nhận diện món ăn trong ảnh và phân tích dinh dưỡng."
            )
            if description:
                prompt_text += f" Mô tả thêm từ bệnh nhân: {description}"
            
            # Danh sách các model Vision miễn phí của OpenRouter để tự động fallback khi bị rate limit (429) hoặc bận (503/504)
            vision_models = [
                'google/gemma-4-31b-it:free',
                'nvidia/nemotron-3.5-super-vl:free',
                'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free'
            ]

            for model_name in vision_models:
                try:
                    print(f"[INFO] Đang thử phân tích dinh dưỡng (ảnh) bằng model: {model_name}...")
                    reply = call_openrouter_api(
                        prompt=prompt_text,
                        system_prompt=None,
                        base64_image=base64_data,
                        model=model_name
                    )
                    if reply:
                        print(f"✓ Phân tích ảnh thành công bằng model: {model_name}")
                        break
                except Exception as model_err:
                    print(f"[WARN] Lỗi khi gọi model vision {model_name}: {model_err}")
                    last_err = model_err

            if not reply and gemini_mgr is not None and gemini_mgr.is_available:
                try:
                    missing_padding = len(base64_data) % 4
                    padded_b64 = base64_data + ("=" * (4 - missing_padding) if missing_padding else "")
                    img = Image.open(io.BytesIO(base64.b64decode(padded_b64)))
                    gem_res = gemini_mgr.generate_content([prompt_text, img])
                    if gem_res and getattr(gem_res, "text", None):
                        reply = gem_res.text.strip()
                except Exception as gem_err:
                    last_err = gem_err

            if not reply:
                if last_err:
                    raise last_err
                raise ValueError("Tất cả các model Vision đều thất bại.")

        else:
            user_text = f"Phân tích bữa ăn sau và đánh giá tác động tim mạch/cholesterol: {description}"
            reply = generate_text_with_fallback(
                prompt=user_text,
                system_prompt=system_prompt,
                max_tokens=2000,
                temperature=0.7,
            )

        return {
            "reply": reply,
            "has_image": has_image,
            "timestamp": datetime.now().isoformat(),
        }

    except Exception as e:
        print(f"[ERROR] Analyze meal error (OpenRouter): {e}")
        raise HTTPException(
            status_code=503,
            detail="Hệ thống AI phân tích Dinh dưỡng đang bận hoặc tạm thời gián đoạn (OpenRouter). Vui lòng thử lại sau ít phút hoặc nhập lại mô tả của bạn."
        )


# ============================================================================
# ============================================================================
# ENDPOINT: POST /api/emergency-alert - Chẩn đoán cấp cứu bằng hình ảnh
# ============================================================================
def send_automatic_alert_email(receiver_email: str, alert_type: str, image_base64: str, advice: str):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    safe_alert_type = html.escape(alert_type or "Sự cố khẩn cấp")
    safe_advice = html.escape(advice or "")

    # Tạo HTML cho email cảnh báo
    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>CẢNH BÁO GIÁM SÁT Y TẾ KHẨN CẤP</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 2px solid #fca5a5; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #be123c, #e11d48); color: #ffffff; padding: 24px; text-align: center;">
                <span style="font-size: 44px; display: block; margin-bottom: 8px;">⚠️</span>
                <h1 style="margin: 0; font-size: 22px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">CẢNH BÁO GIÁM SÁT KHẨN CẤP</h1>
                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 13px;">Hệ thống giám sát y tế thông minh phát hiện sự cố</p>
            </div>
            
            <div style="padding: 24px;">
                <p style="font-size: 16px; line-height: 1.6; color: #1e293b; margin-top: 0; font-weight: bold;">
                    Kính gửi Người thân bệnh nhân / Người liên hệ khẩn cấp,
                </p>
                
                <div style="background-color: #fff1f2; border-left: 4px solid #f43f5e; padding: 16px; border-radius: 8px; margin-bottom: 20px;">
                    <p style="margin: 0; font-size: 15px; color: #9f1239; font-weight: bold;">
                        🚨 PHÁT HIỆN SỰ CỐ: {safe_alert_type.upper()}
                    </p>
                    <p style="margin: 6px 0 0 0; font-size: 13px; color: #be123c; line-height: 1.5;">
                        Hệ thống Edge AI y tế trong phòng giám sát vừa ghi nhận sự cố bất thường của bệnh nhân vào lúc {datetime.now().strftime('%d/%m/%Y - %H:%M:%S')}.
                    </p>
                </div>

                <div style="margin-bottom: 24px;">
                    <h3 style="color: #475569; font-size: 14px; margin: 0 0 10px 0; border-bottom: 1px solid #e2e8f0; padding-bottom: 6px; text-transform: uppercase; font-weight: 800;">📷 Ảnh chụp từ camera AI tại thời điểm xảy ra sự cố:</h3>
                    <div style="background-color: #0f172a; border-radius: 12px; padding: 8px; text-align: center; border: 1px solid #e2e8f0;">
                        <img src="data:image/jpeg;base64,{image_base64}" style="max-width: 100%; max-height: 300px; border-radius: 6px; object-fit: contain;" alt="Incident Snapshot" />
                    </div>
                </div>

                <div style="margin-bottom: 20px; background-color: #f8fafc; padding: 16px; border-radius: 12px; border: 1px solid #e2e8f0;">
                    <h3 style="color: #9f1239; font-size: 14px; margin: 0 0 8px 0; text-transform: uppercase; font-weight: 800;">🚑 Lời khuyên sơ cứu nhanh từ Bác Sĩ AI:</h3>
                    <div style="font-size: 13px; line-height: 1.6; color: #334155; white-space: pre-wrap;">
{safe_advice}
                    </div>
                </div>

                <p style="font-size: 12px; color: #64748b; line-height: 1.5; margin-top: 24px; font-style: italic;">
                    * Lưu ý: Đây là thông báo tự động từ hệ thống AI giám sát phòng chống đột quỵ và té ngã. Nếu nghi ngờ tình trạng nguy kịch, vui lòng gọi điện thoại ngay cho bệnh nhân hoặc liên hệ đơn vị cấp cứu 115 lập tức.
                </p>
            </div>
            
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 11px; color: #64748b;">
                <p style="margin: 0;">SmartPreventiveHealth - Hệ thống Chăm sóc sức khỏe thông minh và Cảnh báo khẩn cấp</p>
                <p style="margin: 4px 0 0 0;">Vui lòng không trả lời email này.</p>
            </div>
        </div>
    </body>
    </html>
    """

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    subject = f"[CẢNH BÁO KHẨN CẤP] Phát hiện {alert_type} từ hệ thống giám sát y tế!"

    if not smtp_user or not smtp_password:
        print("[SMTP-AUTO] Cấu hình SMTP khuyết. Chạy chế độ Mock.")
        print(f"[SMTP-AUTO-MOCK] Đã tự động gửi email tới: {receiver_email}")
        return {
            "success": True,
            "is_mock": True,
            "message": f"Mô phỏng gửi email cảnh báo tới {receiver_email} thành công! (Chưa cấu hình SMTP trong file .env)."
        }

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = receiver_email
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, receiver_email, msg.as_string())
        server.quit()
        
        print(f"[SMTP-AUTO] Email cảnh báo sự cố đã gửi tới {receiver_email}")
        return {
            "success": True,
            "is_mock": False,
            "message": f"Email cảnh báo tự động đã gửi tới {receiver_email}!"
        }
    except Exception as e:
        print(f"[SMTP-AUTO] Lỗi gửi email cảnh báo thật: {e}. Chuyển sang Mock.")
        return {
            "success": True,
            "is_mock": True,
            "message": f"Mô phỏng gửi tới {receiver_email} thành công! (Lỗi SMTP: {str(e)})."
        }

# ============================================================================
# GEMINI QUOTA FALLBACK HELPERS
# ============================================================================
FALLBACK_ADVICE_FAST = {
    "Face Asymmetry": "1. Gọi ngay 115 và giữ bệnh nhân ở tư thế nằm nghiêng.\n2. Ghi lại chính xác thời điểm xuất hiện triệu chứng méo miệng.\n3. Không cho bệnh nhân ăn uống, để đầu cao 30° và theo dõi ý thức liên tục.",
    "Fall Detection": "1. Gọi ngay 115, không tự ý di chuyển nạn nhân nếu nghi ngờ chấn thương cột sống.\n2. Kiểm tra ý thức và hô hấp. Nếu không thở: thực hiện hồi sức tim phổi (CPR).\n3. Giữ ấm, không để bệnh nhân vận động cho đến khi có nhân viên y tế.",
}
FALLBACK_ADVICE_HR = {
    "danger": "1. Gọi ngay 115 và cho bệnh nhân ngồi hoặc nằm xuống ở nơi thông thoáng.\n2. Dừng ngay mọi hoạt động thể lực, nới lỏng quần áo cổ và ở ngực.\n3. Theo dõi nhịp tim và ý thức liên tục cho đến khi xe cấp cứu đến.",
    "warning": "1. Để bệnh nhân nghỉ ngơi hoàn toàn, ngồi hoặc nằm ở tư thế thoải mái.\n2. Hít thở sâu, đều đặn (hít 4 giây — nín 4 giây — thở ra 4 giây).\n3. Nếu không giảm trong 10 phút hoặc kèm đau ngực — gọi ngay 115.",
}

def is_quota_error(e: Exception) -> bool:
    """Kiểm tra lỗi 429 / RESOURCE_EXHAUSTED từ Gemini API."""
    msg = str(e).lower()
    return "429" in msg or "resource_exhausted" in msg or "quota" in msg or "rate limit" in msg


def call_openrouter_api(prompt: str, system_prompt: str = None, base64_image: str = None, model: str = 'google/gemma-4-31b-it:free') -> str:
    """Gọi OpenRouter API với model tùy chọn (mặc định là nemotron-nano-vl:free cho vision)"""
    api_key = os.getenv("OPENROUTER_API_KEY", "")
    if not api_key:
        raise ValueError("Chưa cấu hình OPENROUTER_API_KEY trong file .env")

    url = 'https://openrouter.ai/api/v1/chat/completions'
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:8000',
        'X-Title': 'SmartHealthcare',
        'User-Agent': 'Mozilla/5.0'
    }

    if base64_image:
        if not base64_image.startswith("data:image/"):
            base64_image = f"data:image/jpeg;base64,{base64_image}"
        content_list = [
            {'type': 'text', 'text': prompt},
            {
                'type': 'image_url',
                'image_url': {
                    'url': base64_image
                }
            }
        ]
    else:
        content_list = prompt

    messages = []
    if system_prompt:
        messages.append({'role': 'system', 'content': system_prompt})
    messages.append({'role': 'user', 'content': content_list})

    data = {
        'model': model,
        'messages': messages,
        'temperature': 0.8,
        'max_tokens': 2000
    }

    import requests
    try:
        # timeout=(connect_timeout, read_timeout)
        # Tăng thời gian chờ đọc lên 35 giây để xử lý các mô hình Vision chậm của OpenRouter
        response = requests.post(url, headers=headers, json=data, timeout=(5, 35))
        response.raise_for_status()
        res_data = response.json()
        choices = res_data.get("choices", [])
        if choices:
            return choices[0].get("message", {}).get("content", "").strip()
        raise ValueError(f"OpenRouter Response error: {res_data}")
    except requests.exceptions.HTTPError as http_err:
        print(f"[OpenRouter HTTP Error] Code {http_err.response.status_code}: {http_err.response.text}")
        raise ValueError(f"OpenRouter HTTP {http_err.response.status_code}: {http_err.response.text}")
    except Exception as e:
        print(f"[OpenRouter Error] {type(e).__name__}: {e}")
        raise



@app.post("/api/emergency-alert")
async def handle_emergency_alert(request: EmergencyRequest):
    raw_base64_data = (request.image_base64 or "").strip()
    base64_data = raw_base64_data.split(",", 1)[1] if "," in raw_base64_data else raw_base64_data
    prompt = (
        f"Đây là hình ảnh bệnh nhân được camera giám sát chụp lại khi phát hiện dấu hiệu {request.alert_type}. "
        f"Bạn là bác sĩ cấp cứu. Dựa vào tư thế trong ảnh, hãy đưa ra 3 bước sơ cứu khẩn cấp ngắn gọn nhất. "
        f"Không cần giải thích thêm."
    )

    # Giải mã và kiểm tra ảnh hợp lệ trước khi gọi Vision AI
    try:
        missing_padding = len(base64_data) % 4
        if missing_padding:
            base64_data += "=" * (4 - missing_padding)
        image_bytes = base64.b64decode(base64_data)
        img = Image.open(io.BytesIO(image_bytes))
    except Exception as img_err:
        raise HTTPException(status_code=400, detail=f"Ảnh base64 không hợp lệ: {img_err}")

    advice = None
    last_err = None

    # 1. Thử Gemini Vision nếu đã cấu hình
    if gemini_mgr is not None and gemini_mgr.is_available:
        try:
            response = gemini_mgr.generate_content([prompt, img])
            try:
                advice = response.text
            except ValueError:
                advice = "Hình ảnh hoặc yêu cầu bị Gemini AI chặn (Safety Filter). Vui lòng gọi ngay 115 để được hướng dẫn sơ cứu khẩn cấp."
        except Exception as e:
            last_err = e
            print(f"❌ LỖI GEMINI API (/api/emergency-alert): {e}")

    # 2. Fallback qua OpenRouter Vision
    if not advice and os.getenv("OPENROUTER_API_KEY", ""):
        try:
            print("[FALLBACK] Đang thử gọi OpenRouter API cho /api/emergency-alert...")
            advice = call_openrouter_api(
                prompt=prompt,
                system_prompt=None,
                base64_image=base64_data,
                model='google/gemma-4-31b-it:free'
            )
            print("✓ Gọi OpenRouter API thành công cho khẩn cấp!")
        except Exception as or_err:
            last_err = or_err
            print(f"❌ Gọi OpenRouter API cho khẩn cấp thất bại: {or_err}")

    # 3. Fallback lâm sàng dự phòng nếu AI không khả dụng hoặc hết quota
    if not advice:
        print(f"[FALLBACK] Sử dụng lời khuyên sơ cứu dự phòng cho /api/emergency-alert ({last_err})")
        alert_type_key = "Fall Detection" if "fall" in request.alert_type.lower() else "Face Asymmetry"
        advice = FALLBACK_ADVICE_FAST.get(
            alert_type_key,
            "1. Gọi ngay 115 để được hướng dẫn y tế.\n2. Giữ bệnh nhân nằm yên, theo dõi nhịp thở và ý thức.\n3. Không tự ý cho ăn uống hay uống thuốc."
        )

    # 4. Gửi email cảnh báo nếu có email liên hệ
    email_sent = False
    email_is_mock = False
    email_message = None
    if request.contact_email:
        try:
            email_res = send_automatic_alert_email(
                receiver_email=request.contact_email,
                alert_type=request.alert_type,
                image_base64=base64_data,
                advice=advice
            )
            email_is_mock = bool(email_res.get("is_mock", False))
            email_sent = bool(email_res.get("success")) and not email_is_mock
            email_message = email_res.get("message")
        except Exception as email_err:
            print(f"❌ LỖI GỬI EMAIL CẢNH BÁO TỰ ĐỘNG: {email_err}")
            email_message = f"Không thể gửi email: {str(email_err)}"

    return {
        "emergency_advice": advice,
        "email_sent": email_sent,
        "email_is_mock": email_is_mock,
        "email_message": email_message
    }


# ============================================================================
# ENDPOINT: POST /api/heart-rate-advice - Lấy lời khuyên Gemini khi nhịp tim bất thường
# ============================================================================
@app.post("/api/heart-rate-advice")
async def heart_rate_advice(request: HeartRateAdviceRequest):
    bpm = request.bpm
    duration = request.duration_seconds

    if bpm >= 140:
        severity = "nguy hiểm nghiêm trọng (SVT/VT - nhịp nhanh thất)"
    elif bpm >= 120:
        severity = "nguy hiểm (Tachycardia nặng)"
    else:
        severity = "cảnh báo (Tachycardia nhẹ)"

    duration_text = f", duy trì liên tục {duration} giây" if duration else ""
    prompt = (
        f"Bạn là bác sĩ tim mạch cấp cứu. Bệnh nhân vừa được hệ thống AI phát hiện nhịp tim "
        f"{bpm} BPM{duration_text} — mức {severity}. "
        f"Hãy đưa ra đúng 3 bước sơ cứu ngắn gọn nhất, mỗi bước 1 dòng, "
        f"bắt đầu bằng số thứ tự. Không giải thích thêm, không tiêu đề."
    )

    try:
        advice = generate_text_with_fallback(prompt=prompt, max_tokens=300, temperature=0.7)
        return {
            "bpm": bpm,
            "severity": severity,
            "advice": advice
        }
    except Exception as e:
        print(f"[heart-rate-advice] Fallback tĩnh do lỗi AI: {e}")
        sev_key = "danger" if bpm >= 120 else "warning"
        advice = FALLBACK_ADVICE_HR.get(
            sev_key,
            "1. Để bệnh nhân nằm nghỉ ngơi.\n2. Theo dõi nhịp tim.\n3. Gọi cấp cứu 115 nếu có triệu chứng nặng."
        )
        return {
            "bpm": bpm,
            "severity": severity,
            "advice": advice
        }


# ============================================================================
# ENDPOINT: POST /api/send-emergency-email - Gửi email cảnh báo SOS khẩn cấp
# ============================================================================
@app.post("/api/send-emergency-email")
def send_emergency_email(req: EmergencyEmailRequest):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    # Lấy tên user từ DB nếu chưa có
    user_name = req.user_name
    if not user_name and req.user_id:
        try:
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute("SELECT full_name FROM users WHERE user_id = %s", (req.user_id,))
            user = cursor.fetchone()
            if user:
                user_name = user["full_name"]
        except Exception as db_err:
            print(f"[DB ERROR] Không thể lấy tên user: {db_err}")
        finally:
            if 'conn' in locals() and conn.is_connected():
                cursor.close()
                conn.close()

    # Generate HTML content (escape dữ liệu người dùng tránh HTML injection)
    hospitals_li = ""
    for idx, h in enumerate(req.hospitals or []):
        h_name = html.escape(str(h.get('name', 'Bệnh viện')))
        h_phone = html.escape(str(h.get('phone', '')))
        h_dist = float(h.get('distance', 0) or 0)
        hospitals_li += f"""
        <li style="margin-bottom: 8px; font-size: 14px; color: #334155;">
            <strong>{idx+1}. {h_name}</strong>: 
            Cách {h_dist:.2f} km. 
            <a href="tel:{h_phone}" style="color: #ef4444; font-weight: bold; text-decoration: none;">📞 Gọi: {h_phone}</a>
        </li>
        """
    if not hospitals_li:
        hospitals_li = '<li style="color: #64748b; font-style: italic;">Không tìm thấy thông tin bệnh viện gần nhất.</li>'

    user_info_html = ""
    if user_name:
        user_info_html = f"<p style='margin: 4px 0; font-size: 15px;'><strong>Tên bệnh nhân:</strong> {html.escape(str(user_name))}</p>"
    safe_address = html.escape(str(req.address or 'Không rõ địa chỉ cụ thể'))

    html_content = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <title>CẢNH BÁO SOS KHẨN CẤP</title>
    </head>
    <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; padding: 20px; margin: 0;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; border: 2px solid #fca5a5; overflow: hidden; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="background: linear-gradient(135deg, #dc2626, #ef4444); color: #ffffff; padding: 24px; text-align: center;">
                <span style="font-size: 40px; display: block; margin-bottom: 8px;">🚨</span>
                <h1 style="margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px; text-transform: uppercase;">CẢNH BÁO SOS KHẨN CẤP</h1>
                <p style="margin: 4px 0 0 0; opacity: 0.9; font-size: 14px;">SmartPreventiveHealth - Hệ thống giám sát y tế thông minh</p>
            </div>
            
            <div style="padding: 24px;">
                <p style="font-size: 16px; line-height: 1.6; color: #1e293b; margin-top: 0;">
                    Kính gửi người thân bệnh nhân,
                </p>
                <p style="font-size: 15px; line-height: 1.6; color: #334155; background-color: #fef2f2; border-left: 4px solid #ef4444; padding: 12px; border-radius: 8px; margin-bottom: 20px;">
                    Hệ thống vừa ghi nhận yêu cầu cứu hộ khẩn cấp (SOS) từ người dùng. Cuộc gọi điện thoại trực tiếp có thể gặp sự cố nên hệ thống đã tự động gửi thông tin vị trí định vị này cho bạn qua Email.
                </p>
                
                <div style="margin-bottom: 20px;">
                    <h3 style="color: #991b1b; font-size: 16px; margin: 0 0 8px 0; border-bottom: 1px solid #fee2e2; padding-bottom: 4px; text-transform: uppercase;">Thông tin người cần cứu hộ:</h3>
                    {user_info_html}
                    <p style="margin: 4px 0; font-size: 15px;"><strong>Thời gian:</strong> {datetime.now().strftime('%d/%m/%Y - %H:%M:%S')}</p>
                    <p style="margin: 4px 0; font-size: 15px;"><strong>Tọa độ GPS:</strong> {req.latitude:.5f}° N, {req.longitude:.5f}° E</p>
                    <p style="margin: 4px 0; font-size: 15px;"><strong>Địa chỉ định vị:</strong> <span style="color: #0f172a; font-weight: bold;">{safe_address}</span></p>
                </div>
                
                <div style="text-align: center; margin: 28px 0;">
                    <a href="https://www.google.com/maps?q={req.latitude},{req.longitude}" target="_blank" style="background-color: #ef4444; color: #ffffff; padding: 14px 28px; border-radius: 8px; font-weight: bold; text-decoration: none; display: inline-block; box-shadow: 0 4px 12px rgba(239, 68, 68, 0.3); font-size: 15px;">
                        📍 Xem Vị Trí Trên Google Maps
                    </a>
                </div>
                
                <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0;">
                    <h3 style="color: #475569; font-size: 14px; margin: 0 0 10px 0; text-transform: uppercase;">🏥 Bệnh viện gần nhất được định vị:</h3>
                    <ul style="padding-left: 20px; margin: 0;">
                        {hospitals_li}
                    </ul>
                </div>
            </div>
            
            <div style="background-color: #f8fafc; border-top: 1px solid #e2e8f0; padding: 16px; text-align: center; font-size: 12px; color: #64748b;">
                <p style="margin: 0;">Đây là email tự động từ ứng dụng SmartPreventiveHealth.</p>
                <p style="margin: 4px 0 0 0;">Vui lòng không trả lời email này.</p>
            </div>
        </div>
    </body>
    </html>
    """

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    subject = "[CẢNH BÁO SOS KHẨN CẤP] Người thân của bạn đang gặp tình huống nguy kịch!"

    if not smtp_user or not smtp_password:
        print("[SMTP] Cấu hình SMTP khuyết. Chạy chế độ Mock.")
        print(f"[SMTP-MOCK] Đã gửi email tới: {req.receiver_email}")
        print(f"[SMTP-MOCK] Tiêu đề: {subject}")
        print(f"[SMTP-MOCK] Nội dung: {html_content[:500]}...")
        return {
            "success": True,
            "is_mock": True,
            "message": f"Đã mô phỏng gửi email SOS tới {req.receiver_email} thành công! (Chế độ Mock do chưa cấu hình SMTP trong file .env)."
        }

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = req.receiver_email
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, req.receiver_email, msg.as_string())
        server.quit()
        
        print(f"[SMTP] Email SOS đã được gửi thật tới {req.receiver_email}")
        return {
            "success": True,
            "is_mock": False,
            "message": f"Email SOS đã được gửi thật thành công tới {req.receiver_email}!"
        }
    except Exception as e:
        print(f"[SMTP] Lỗi khi gửi email thật: {e}. Chuyển sang mô phỏng Mock.")
        return {
            "success": True,
            "is_mock": True,
            "message": f"Không thể gửi email thật qua SMTP ({str(e)}). Đã chuyển sang mô phỏng gửi tới {req.receiver_email} thành công!"
        }


# ============================================================================
# ENDPOINT: POST /api/test-email - Kiểm thử gửi email cảnh báo
# ============================================================================
class TestEmailRequest(BaseModel):
    receiver_email: str

@app.post("/api/test-email")
def test_email(req: TestEmailRequest):
    import smtplib
    from email.mime.text import MIMEText
    from email.mime.multipart import MIMEMultipart

    smtp_host = os.getenv("SMTP_HOST", "smtp.gmail.com")
    smtp_port = int(os.getenv("SMTP_PORT", "587"))
    smtp_user = os.getenv("SMTP_USER")
    smtp_password = os.getenv("SMTP_PASSWORD")

    subject = "[SmartPreventiveHealth] Kiểm thử gửi email cảnh báo"
    html_content = f"""
    <html>
    <body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
        <div style="max-width: 600px; margin: 0 auto; background-color: #ffffff; padding: 20px; border-radius: 8px; border: 1px solid #ddd;">
            <h2 style="color: #ef4444; text-align: center;">SmartPreventiveHealth</h2>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p>Xin chào,</p>
            <p>Đây là <b>Email Thử Nghiệm</b> được gửi từ nút kiểm tra trong cấu hình giám sát sức khỏe của bạn.</p>
            <p>Nếu bạn nhận được email này, tính năng gửi email cảnh báo khẩn cấp qua tài khoản gửi <b>{smtp_user}</b> đang hoạt động hoàn toàn chính xác!</p>
            <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;">
            <p style="font-size: 11px; color: #777; text-align: center;">Đây là email tự động từ ứng dụng SmartPreventiveHealth.</p>
        </div>
    </body>
    </html>
    """

    if not smtp_user or not smtp_password:
        return {
            "success": False,
            "message": "Không tìm thấy cấu hình SMTP_USER hoặc SMTP_PASSWORD trong file .env."
        }

    try:
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = smtp_user
        msg['To'] = req.receiver_email
        
        part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(part)
        
        server = smtplib.SMTP(smtp_host, smtp_port)
        server.ehlo()
        server.starttls()
        server.login(smtp_user, smtp_password)
        server.sendmail(smtp_user, req.receiver_email, msg.as_string())
        server.quit()
        
        print(f"[SMTP] Email test đã được gửi thật tới {req.receiver_email}")
        return {
            "success": True,
            "message": f"Email thử nghiệm đã được gửi thành công tới {req.receiver_email}!"
        }
    except Exception as e:
        print(f"[SMTP] Lỗi gửi email test: {e}")
        return {
            "success": False,
            "message": f"Gửi email test thất bại: {str(e)}"
        }


# ============================================================================
# ENDPOINT: POST /api/chat - Chat với Bác sĩ AI (Gemini)
# ============================================================================
@app.post("/api/chat")
def chat(req: ChatRequest, current_user: dict = Depends(get_current_user)):
    """
    Chat với Bác sĩ AI
    - Gọi Gemini / OpenRouter / Groq (auto-fallback)
    - System prompt: Bác sĩ AI chuyên tim mạch & dinh dưỡng
    - Lưu lịch sử vào chat_logs
    """
    if req.user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Không có quyền truy cập phiên chat của người dùng khác.")

    require_gemini()

    if not req.message or not req.message.strip():
        raise HTTPException(status_code=400, detail="Tin nhắn không được để trống.")

    conn = None
    cursor = None
    try:
        user_id = req.user_id
        message_text = req.message.strip()
        chat_type = req.chat_type or "general"

        print(f"[DEBUG] Chat request - User: {user_id}, Type: {chat_type}, Message: {message_text[:100]}")

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
                "- Giải thích rõ ràng, dễ hiểu cho người bình thường.\n"
                "- Cung cấp LỜI KHUYÊN THỰC TẾ mà bệnh nhân có thể áp dụng ngay.\n"
                "- Nếu triệu chứng nghiêm trọng, NHẮC gặp bác sĩ hoặc gọi 115.\n"
                "- KHÔNG chẩn đoán thay bác sĩ, chỉ tư vấn phòng ngừa.\n"
                "- Giọng điệu: ấm áp, dễ tiếp cận, như bác sĩ thực thụ.\n"
                "- CHỈ TRẢ LỜI CHI TIẾT - không kèm ghi chú hay template."
            )

        try:
            reply = generate_text_with_fallback(
                prompt=message_text,
                system_prompt=system_prompt,
                max_tokens=2000,
                temperature=0.8,
            )
        except Exception as ai_err:
            print(f"[ERROR] Tất cả AI provider cho /api/chat thất bại: {ai_err}")
            if is_quota_error(ai_err):
                return {
                    "reply": "Hệ thống Bác sĩ AI đang bận do vượt quá giới hạn lượt dùng thử miễn phí (API Quota Exceeded). Vui lòng thử lại sau ít phút hoặc liên hệ trực tiếp với cơ sở y tế nếu bạn đang có các triệu chứng khẩn cấp.",
                    "chat_type": chat_type,
                    "session_id": req.session_id or str(uuid.uuid4()),
                    "timestamp": datetime.now().isoformat(),
                }
            return JSONResponse(
                status_code=503,
                content={
                    "detail": f"Máy chủ AI tạm thời gián đoạn: {str(ai_err)}",
                    "error_type": type(ai_err).__name__
                }
            )

        # Lưu vào database
        try:
            conn = get_db_connection()
            cursor = conn.cursor()

            session_id = req.session_id if req.session_id else str(uuid.uuid4())
            cursor.execute(
                "INSERT INTO chat_logs (user_id, session_id, user_message, ai_response) VALUES (%s, %s, %s, %s)",
                (user_id, session_id, message_text, reply),
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
            "session_id": session_id,
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
# ENDPOINT: GET /api/chat/sessions/{user_id} - Lấy danh sách phiên trò chuyện
# ============================================================================
@app.get("/api/chat/sessions/{user_id}")
def get_chat_sessions(user_id: int, limit: int = 30, current_user: dict = Depends(get_current_user)):
    """Lấy danh sách phiên chat gần đây của user."""
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Không có quyền xem lịch sử phiên chat của người dùng khác.")
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        # Nhóm theo session_id, lấy tin nhắn đầu làm tiêu đề, sắp xếp theo thời gian mới nhất
        cursor.execute(
            """
            SELECT session_id, MIN(created_at) as start_time, 
                   SUBSTRING(MIN(user_message), 1, 50) as title 
            FROM chat_logs 
            WHERE user_id = %s AND session_id IS NOT NULL
            GROUP BY session_id 
            ORDER BY start_time DESC 
            LIMIT %s
            """,
            (user_id, min(limit, 50)),
        )
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get("start_time"), datetime):
                row["start_time"] = row["start_time"].isoformat()
        return rows
    except Exception as e:
        print(f"[ERROR] Chat sessions error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy danh sách phiên: {str(e)}")
    finally:
        if "conn" in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: GET /api/chat/session/{session_id} - Lịch sử một phiên tư vấn AI
# ============================================================================
@app.get("/api/chat/session/{session_id}")
def get_chat_session_logs(session_id: str, current_user: dict = Depends(get_current_user)):
    """Lấy toàn bộ tin nhắn của một phiên chat cụ thể."""
    try:
        conn = get_db_connection()
        cursor = conn.cursor(dictionary=True)
        cursor.execute(
            """
            SELECT chat_id, user_message, ai_response, created_at
            FROM chat_logs
            WHERE session_id = %s AND user_id = %s
            ORDER BY created_at ASC
            """,
            (session_id, current_user["user_id"]),
        )
        rows = cursor.fetchall()
        for row in rows:
            if isinstance(row.get("created_at"), datetime):
                row["created_at"] = row["created_at"].isoformat()
        return rows
    except Exception as e:
        print(f"[ERROR] Chat session logs error: {e}")
        raise HTTPException(status_code=500, detail=f"Lỗi lấy lịch sử phiên chat: {str(e)}")
    finally:
        if "conn" in locals() and conn.is_connected():
            cursor.close()
            conn.close()

# ============================================================================
# ENDPOINT: GET /api/chat/logs/{user_id} - Lịch sử tư vấn AI (Legacy)
# ============================================================================
@app.get("/api/chat/logs/{user_id}")
def get_chat_logs(user_id: int, limit: int = 30, current_user: dict = Depends(get_current_user)):
    """Lấy lịch sử chat gần đây của user."""
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Không có quyền xem lịch sử chat của người dùng khác.")
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
def get_history(user_id: int, current_user: dict = Depends(get_current_user)):
    """
    Lấy lịch sử đo khám của user
    - Trả về 20 bản ghi gần nhất
    - Dùng để vẽ biểu đồ lịch sử
    """
    if user_id != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Không có quyền xem lịch sử sức khỏe của người dùng khác.")
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
    if gemini_mgr is None or not gemini_mgr.is_available:
        raise HTTPException(
            status_code=503,
            detail="Tính năng phân tích giọng nói từ video yêu cầu GEMINI_API_KEYS trong backend/.env.",
        )

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

        response = gemini_mgr.generate_content([gemini_file, prompt])
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
