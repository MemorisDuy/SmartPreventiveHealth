import base64
import io
from PIL import Image
import google.generativeai as genai

# Mock the logic in emergency_alert
def test_emergency():
    try:
        # Create a dummy image
        img = Image.new('RGB', (100, 100), color = 'red')
        buffered = io.BytesIO()
        img.save(buffered, format="JPEG")
        img_str = base64.b64encode(buffered.getvalue()).decode()
        
        base64_data = "data:image/jpeg;base64," + img_str
        
        if "," in base64_data:
            base64_data = base64_data.split(",")[1]
            
        missing_padding = len(base64_data) % 4
        if missing_padding:
            base64_data += "=" * (4 - missing_padding)
            
        image_bytes = base64.b64decode(base64_data)
        img_out = Image.open(io.BytesIO(image_bytes))
        
        print("Image decoded successfully, size:", img_out.size)
        
    except Exception as e:
        print(f"Error: {e}")

test_emergency()
