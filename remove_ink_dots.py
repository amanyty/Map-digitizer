import cv2
import numpy as np

def ultra_clean(input_path, output_path, crop=False):
    print(f"Processing {input_path}...")
    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to read {input_path}")
        return

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Apply cropping for Baskhedi to ensure alignment with existing POIs!
    if crop:
        h, w = gray.shape
        gray = gray[int(h*0.02):int(h*0.98), int(w*0.02):int(w*0.98)]
    
    # 1. Bilateral filter to smooth out paper texture/noise while keeping ink edges sharp
    gray = cv2.bilateralFilter(gray, 11, 75, 75)
    
    # 2. Normalize illumination to remove shadows and gradients
    # This flattens the lighting so the paper is a uniform color
    blur = cv2.GaussianBlur(gray, (151, 151), 0)
    norm = cv2.divide(gray, blur, scale=255)
    
    # 3. Global Threshold
    # Since illumination is uniform, a fixed threshold safely separates ink from paper
    # without creating the "ink dots" that adaptive thresholding causes in empty areas.
    _, thresh = cv2.threshold(norm, 235, 255, cv2.THRESH_BINARY)
    
    # 4. Remove leftover small ink dots (salt noise)
    # Median blur is incredible at removing salt-and-pepper noise (ink dots) 
    # while completely preserving the shape of solid lines and text!
    cleaned = cv2.medianBlur(thresh, 5)
    
    # 5. Connect any broken lines slightly
    kernel = np.ones((2,2), np.uint8)
    cleaned = cv2.morphologyEx(cleaned, cv2.MORPH_CLOSE, kernel, iterations=1)

    cv2.imwrite(output_path, cleaned)
    print(f"Saved {output_path}")

# Baskhedi MUST be cropped to match the coordinates the user has already digitized
ultra_clean('public/social map of Baskhedi (1)_2.jpg', 'public/baskhedi_ultra.png', crop=True)

# Map 2 can use the enhanced version as the base, no crop needed
ultra_clean('public/map2_enhanced.jpeg', 'public/map2_ultra.png', crop=False)
