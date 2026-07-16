import cv2
import numpy as np
from PIL import Image

def ultra_clean(input_path, output_path, use_process_map_crop=False):
    print(f"Processing {input_path}...")
    
    if use_process_map_crop:
        # 1. Use PIL to exactly match the crop and resize of process_map.py
        img_pil = Image.open(input_path)
        w, h = img_pil.size
        left = int(w * 0.03)
        top = int(h * 0.02)
        right = int(w * 0.98)
        bottom = int(h * 0.98)
        img_pil = img_pil.crop((left, top, right, bottom))
        img_pil = img_pil.resize((1024, 1024), Image.Resampling.LANCZOS)
        # Convert PIL back to OpenCV BGR format
        img = cv2.cvtColor(np.array(img_pil), cv2.COLOR_RGB2BGR)
    else:
        img = cv2.imread(input_path)
        if img is None:
            print(f"Failed to read {input_path}")
            return

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # 2. Bilateral filter to smooth out paper texture/noise while keeping ink edges sharp
    gray = cv2.bilateralFilter(gray, 11, 75, 75)
    
    # 3. Normalize illumination to remove shadows and gradients
    blur = cv2.GaussianBlur(gray, (151, 151), 0)
    norm = cv2.divide(gray, blur, scale=255)
    
    # 4. Global Threshold
    _, thresh = cv2.threshold(norm, 235, 255, cv2.THRESH_BINARY)
    
    # 5. Remove leftover small ink dots (salt noise)
    cleaned = cv2.medianBlur(thresh, 5)
    
    # 6. Connect any broken lines slightly
    kernel = np.ones((2,2), np.uint8)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=1)

    cv2.imwrite(output_path, cleaned)
    print(f"Saved {output_path}")

# Baskhedi MUST be cropped to match the coordinates the user has already digitized
ultra_clean('public/social map of Baskhedi (1)_2.jpg', 'public/baskhedi_ultra.png', use_process_map_crop=True)

# Map 2 can use the enhanced version as the base, no crop needed
ultra_clean('public/map2_enhanced.jpeg', 'public/map2_ultra.png', use_process_map_crop=False)
