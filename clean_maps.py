import cv2
import numpy as np

def clean_map_color(input_path, output_path, scale=2.0):
    img = cv2.imread(input_path)
    if img is None:
        print(f"Could not read {input_path}")
        return
        
    # Upscale for better quality
    img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)
    
    # Convert to LAB space to separate luminance
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
    l, a, b = cv2.split(lab)
    
    # Apply CLAHE to L channel to bring out details
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
    cl = clahe.apply(l)
    
    # Merge back
    enhanced_lab = cv2.merge((cl, a, b))
    enhanced_bgr = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)
    
    # Background normalization
    gray = cv2.cvtColor(enhanced_bgr, cv2.COLOR_BGR2GRAY)
    
    # Normalize lighting using a large blur
    blur = cv2.GaussianBlur(gray, (101, 101), 0)
    
    # Divide original by blur to get illumination invariant image
    # This flattens the lighting so the background is uniformly bright
    result = cv2.divide(gray, blur, scale=255)
    
    # Now we have a very clean grayscale image where background is near 255.
    # We apply a slight contrast stretch to make text darker and background whiter
    result = cv2.normalize(result, None, alpha=0, beta=255, norm_type=cv2.NORM_MINMAX)
    
    # Threshold to find the background
    # Everything above 200 is considered background paper
    _, mask = cv2.threshold(result, 200, 255, cv2.THRESH_BINARY)
    
    # Slightly dilate the mask to eat into the edges of the noise
    kernel = np.ones((2,2), np.uint8)
    mask = cv2.erode(mask, kernel, iterations=1) # erode the mask means dilate the text
    
    # Where mask is white (background), make the original image pure white
    enhanced_bgr[mask == 255] = [255, 255, 255]
    
    # Optionally, we can sharpen the image
    sharp_kernel = np.array([[-1,-1,-1], [-1,9,-1], [-1,-1,-1]])
    enhanced_bgr = cv2.filter2D(enhanced_bgr, -1, sharp_kernel)
    
    cv2.imwrite(output_path, enhanced_bgr)
    print(f"Saved {output_path}")

if __name__ == "__main__":
    clean_map_color('public/social map of Baskhedi (1)_2.jpg', 'public/baskhedi_clean.png', scale=1.5)
    clean_map_color('public/map2.jpeg', 'public/map2_clean.png', scale=2.0)
