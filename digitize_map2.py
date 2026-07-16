import cv2
import numpy as np

def make_digital_drawn(input_path, output_path):
    print(f"Processing {input_path}...")
    img = cv2.imread(input_path)
    if img is None:
        print(f"Failed to read {input_path}")
        return

    # Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    
    # Smooth the image to reduce noise
    blurred = cv2.GaussianBlur(gray, (3, 3), 0)
    
    # Apply a slightly aggressive adaptive threshold to make lines crisp black and background white
    thresh = cv2.adaptiveThreshold(blurred, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                                   cv2.THRESH_BINARY, 21, 10)
                                   
    # Morphological operations to clean up "ink blots" and smooth lines
    kernel = np.ones((2,2), np.uint8)
    
    # Morphological open to remove tiny noise
    cleaned = cv2.morphologyEx(thresh, cv2.MORPH_OPEN, kernel, iterations=1)

    # Save
    cv2.imwrite(output_path, cleaned)
    print(f"Saved {output_path}")

# Process Map 2 using the high contrast enhanced image as base
make_digital_drawn('public/map2_enhanced.jpeg', 'public/map2_stylized.jpeg')
