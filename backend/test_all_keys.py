import os
import sys
import google.generativeai as genai
from dotenv import load_dotenv

# Reconfigure stdout for UTF-8 just in case
if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    except Exception:
        pass

load_dotenv()

# Lấy các key
keys_str = os.getenv("GEMINI_API_KEYS", "")
keys = [k.strip() for k in keys_str.split(",") if k.strip()]

print(f"Loaded keys: {len(keys)}")

for idx, key in enumerate(keys):
    print(f"\n--- Testing Key #{idx + 1}: {key[:15]}...{key[-5:] if len(key) > 5 else ''} ---")
    try:
        genai.configure(api_key=key)
        # Sử dụng gemini-2.0-flash
        model = genai.GenerativeModel('gemini-2.0-flash')
        response = model.generate_content("Hello, this is a test.")
        print(f"[SUCCESS] Response: {response.text}")
    except Exception as e:
        print(f"[FAILED] Error: {type(e).__name__} - {e}")
