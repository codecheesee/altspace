#!/usr/bin/env python3
import os
import sys
from PIL import Image

def generate_icons(src_image_path, target_dir):
    if not os.path.exists(src_image_path):
        print(f"Error: Source image {src_image_path} does not exist.")
        return False

    os.makedirs(target_dir, exist_ok=True)
    img = Image.open(src_image_path).convert("RGBA")
    
    # Crop to the squircle bounds if needed or resize directly
    # The rendered image has the squircle nicely centered
    w, h = img.size
    print(f"Processing source master icon ({w}x{h})...")

    # Standard Tauri & Windows App Resolutions
    sizes = {
        "icon.png": (512, 512),
        "128x128.png": (128, 128),
        "128x128@2x.png": (256, 256),
        "32x32.png": (32, 32),
        "StoreLogo.png": (50, 50),
        "Square30x30Logo.png": (30, 30),
        "Square44x44Logo.png": (44, 44),
        "Square71x71Logo.png": (71, 71),
        "Square89x89Logo.png": (89, 89),
        "Square107x107Logo.png": (107, 107),
        "Square142x142Logo.png": (142, 142),
        "Square150x150Logo.png": (150, 150),
        "Square284x284Logo.png": (284, 284),
        "Square310x310Logo.png": (310, 310)
    }

    for filename, (dim_w, dim_h) in sizes.items():
        resized = img.resize((dim_w, dim_h), Image.Resampling.LANCZOS)
        out_path = os.path.join(target_dir, filename)
        resized.save(out_path, format="PNG")
        print(f"  [+] Generated {filename} ({dim_w}x{dim_h})")

    # Multi-resolution Windows .ico (16, 24, 32, 48, 64, 128, 256)
    ico_sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    ico_path = os.path.join(target_dir, "icon.ico")
    img.save(ico_path, format="ICO", sizes=ico_sizes)
    print(f"  [+] Generated multi-resolution Windows icon: {ico_path}")

    return True

if __name__ == "__main__":
    src = sys.argv[1] if len(sys.argv) > 1 else r"C:\Users\rohan\.gemini\antigravity\brain\cb9b9ccc-bd11-47e7-89dc-ebe0f7d58dd9\altspace_app_icon_1792436674148.jpg"
    dest = sys.argv[2] if len(sys.argv) > 2 else os.path.join(os.path.dirname(__file__), "..", "frontend", "src-tauri", "icons")
    generate_icons(src, dest)
