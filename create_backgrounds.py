"""
Script tạo hình nền cho SmartHealthcare
- webmaytinh.png: Background desktop (1920x1080)
- webdienthoai.png: Background mobile (540x960)
"""

from PIL import Image, ImageDraw
import os

# Thư mục lưu ảnh
output_dir = os.path.join(os.path.dirname(__file__), 'frontend', 'src', 'assets')
os.makedirs(output_dir, exist_ok=True)

# ============================================================================
# 1. Tạo background desktop (webmaytinh.png)
# ============================================================================
print("📐 Tạo background desktop...")

width_desktop = 1920
height_desktop = 1080

# Tạo image với gradient từ trắng sang xanh nhạt
img_desktop = Image.new('RGB', (width_desktop, height_desktop), color=(255, 255, 255))
pixels = img_desktop.load()

# Gradient từ trắng (top) sang xanh nhạt (bottom)
for y in range(height_desktop):
    ratio = y / height_desktop
    # RGB: Từ (255,255,255) đến (240,250,255) - xanh rất nhạt
    r = int(255 - (255 - 240) * ratio)
    g = int(255 - (255 - 250) * ratio)
    b = int(255)
    
    for x in range(width_desktop):
        pixels[x, y] = (r, g, b)

# Vẽ các circle decorative nhạt (giống medical theme)
draw = ImageDraw.Draw(img_desktop, 'RGBA')

# Circle lớn ở góc trên phải (trong suốt)
draw.ellipse(
    [(width_desktop - 400, -100), (width_desktop + 200, 300)],
    fill=(200, 220, 255, 30),  # Xanh rất nhạt, trong suốt
    outline=None
)

# Circle ở góc dưới trái
draw.ellipse(
    [(-200, height_desktop - 300), (300, height_desktop + 100)],
    fill=(220, 240, 255, 25),  # Xanh cực nhạt, trong suốt
    outline=None
)

# Circle ở giữa (background)
draw.ellipse(
    [(width_desktop // 2 - 200, height_desktop // 2 - 200), 
     (width_desktop // 2 + 200, height_desktop // 2 + 200)],
    fill=(230, 245, 255, 20),  # Xanh cực cực nhạt
    outline=None
)

# Lưu ảnh
desktop_path = os.path.join(output_dir, 'webmaytinh.png')
img_desktop.save(desktop_path, 'PNG')
print(f"✅ Đã tạo: {desktop_path} (1920x1080)")

# ============================================================================
# 2. Tạo background mobile (webdienthoai.png)
# ============================================================================
print("📱 Tạo background mobile...")

width_mobile = 540
height_mobile = 960

# Tạo image với gradient từ trắng sang xanh nhạt (dọc - phù hợp mobile)
img_mobile = Image.new('RGB', (width_mobile, height_mobile), color=(255, 255, 255))
pixels_mobile = img_mobile.load()

# Gradient từ trắng (top) sang xanh nhạt (bottom)
for y in range(height_mobile):
    ratio = y / height_mobile
    # RGB: Từ (255,255,255) đến (240,250,255) - xanh rất nhạt
    r = int(255 - (255 - 240) * ratio)
    g = int(255 - (255 - 250) * ratio)
    b = int(255)
    
    for x in range(width_mobile):
        pixels_mobile[x, y] = (r, g, b)

# Vẽ các circle decorative
draw_mobile = ImageDraw.Draw(img_mobile, 'RGBA')

# Circle ở top right
draw_mobile.ellipse(
    [(width_mobile - 150, -50), (width_mobile + 100, 200)],
    fill=(200, 220, 255, 30),
    outline=None
)

# Circle ở bottom left
draw_mobile.ellipse(
    [(-100, height_mobile - 200), (150, height_mobile + 100)],
    fill=(220, 240, 255, 25),
    outline=None
)

# Circle ở giữa (nhỏ hơn trên mobile)
draw_mobile.ellipse(
    [(width_mobile // 2 - 100, height_mobile // 2 - 100), 
     (width_mobile // 2 + 100, height_mobile // 2 + 100)],
    fill=(230, 245, 255, 20),
    outline=None
)

# Lưu ảnh
mobile_path = os.path.join(output_dir, 'webdienthoai.png')
img_mobile.save(mobile_path, 'PNG')
print(f"✅ Đã tạo: {mobile_path} (540x960)")

print("\n" + "="*60)
print("🎉 Hoàn thành!")
print("="*60)
print(f"\n📸 Hai ảnh nền đã được tạo tại:")
print(f"   1. {desktop_path}")
print(f"   2. {mobile_path}")
print("\n💡 Hướng dẫn sử dụng:")
print("   - Thêm vào CSS: background-image: url('/assets/webmaytinh.png')")
print("   - Hoặc import vào React components")
