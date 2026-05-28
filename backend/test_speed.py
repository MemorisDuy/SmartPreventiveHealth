import os
import time
import google.generativeai as genai
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv("GEMINI_API_KEY")

if not api_key:
    print("Error: GEMINI_API_KEY not found in .env")
    exit(1)

genai.configure(api_key=api_key)

# Test models
test_models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
    'gemini-flash-latest',
    'gemini-3-flash-preview',
]

test_prompt = "Xin chào, bạn là ai?"

print("=" * 60)
print("KIỂM TRA TỐC ĐỘ CÁC GEMINI MODELS")
print("=" * 60)

for model_name in test_models:
    try:
        print(f"\n🔄 Đang test: {model_name}")
        model = genai.GenerativeModel(model_name)
        
        start = time.time()
        response = model.generate_content(test_prompt)
        elapsed = time.time() - start
        
        reply_length = len(response.text) if response and response.text else 0
        print(f"   ✓ Thành công: {elapsed:.2f}s | Độ dài reply: {reply_length} ký tự")
        print(f"   Reply: {response.text[:80]}...")
        
    except Exception as e:
        print(f"   ✗ Lỗi: {str(e)[:100]}")

print("\n" + "=" * 60)
