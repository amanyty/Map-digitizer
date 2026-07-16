import cv2
import numpy as np
import sys

def clean_map(input_path, output_path, crop=False):
    print(f"Processing {input_path}...")
    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to read {input_path}")
        return

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Optional cropping to remove edges
    if crop:
        h, w = gray.shape
        gray = gray[int(h*0.02):int(h*0.98), int(w*0.02):int(w*0.98)]
        
    # Apply Gaussian Blur to smooth out noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Apply adaptive thresholding with gentler parameters to preserve text
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY, 41, 10)
                                   
    # Minimal morphological operations to avoid eating the text
    kernel = np.ones((2,2), np.uint8)
    
    # Morphological open to remove tiny noise
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)
    
    # Skip heavy dilation to preserve text legibility
    # cleaned = cv2.dilate(cleaned, kernel, iterations=1)

    # Save
    cv2.imwrite(output_path, cleaned)
    print(f"Saved {output_path}")

# Process Baskhedi Map
clean_map('public/social map of Baskhedi (1)_2.jpg', 'public/baskhedi_stylized_map.png', crop=True)

# Process Map 2
clean_map('public/map2.jpeg', 'public/map2_stylized.jpeg', crop=False)
