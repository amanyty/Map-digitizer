import cv2
import numpy as np
import sys

def enhance_image(image_path, output_path):
    img = cv2.imread(image_path)
    if img is None:
        print(f"Error: Could not load image at {image_path}")
        sys.exit(1)
        
    # 1. Convert to LAB color space to enhance brightness/contrast without affecting colors
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l_channel, a, b = cv2.split(lab)
    
    # Apply CLAHE (Contrast Limited Adaptive Histogram Equalization) to L-channel
    clahe = cv2.createCLAHE(clipLimit=2.5, tileGridSize=(8,8))
    cl = clahe.apply(l_channel)
    
    # Merge back and convert to BGR
    limg = cv2.merge((cl,a,b))
    enhanced_img = cv2.cvtColor(limg, cv2.COLOR_LAB2BGR)
    
    # 2. Sharpening filter to make text edges crisper
    kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    sharp = cv2.filter2D(enhanced_img, -1, kernel)
    
    # 3. Blend the sharpened image with the CLAHE image to avoid too much noise
    final = cv2.addWeighted(enhanced_img, 0.4, sharp, 0.6, 0)
    
    # Write output
    success = cv2.imwrite(output_path, final)
    if success:
        print(f"Successfully saved enhanced map to {output_path}")
    else:
        print("Failed to save enhanced image.")

if __name__ == "__main__":
    enhance_image(r"c:\Users\amany\Desktop\Map-digitzer\public\map3.jpeg", r"c:\Users\amany\Desktop\Map-digitzer\public\map3_enhanced.jpeg")
