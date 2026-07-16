import cv2
import numpy as np
from PIL import Image, ImageEnhance

# 1. First, use PIL to enhance the image just like Map 2
img_path = 'public/social map of Baskhedi (1)_2.jpg'
img = Image.open(img_path)

# Increase brightness and contrast
enhancer_b = ImageEnhance.Brightness(img)
img = enhancer_b.enhance(1.15)

enhancer_c = ImageEnhance.Contrast(img)
img = enhancer_c.enhance(1.2)

# Increase color saturation
enhancer_s = ImageEnhance.Color(img)
img = enhancer_s.enhance(1.3)

# Save intermediate PIL result
temp_path = 'public/temp_baskhedi.jpg'
img.save(temp_path, "JPEG", quality=100)

# 2. Now use OpenCV to turn the brown sketch lines to blue
cv_img = cv2.imread(temp_path)
hsv = cv2.cvtColor(cv_img, cv2.COLOR_BGR2HSV)

# Define range for brown color in HSV
lower_brown = np.array([5, 40, 20])
upper_brown = np.array([35, 255, 180])

mask = cv2.inRange(hsv, lower_brown, upper_brown)

# Change hue of masked pixels to blue (Hue 115)
hsv[:,:,0] = np.where(mask > 0, 115, hsv[:,:,0])
# Boost saturation so it looks like a blue sketch pen
hsv[:,:,1] = np.where(mask > 0, np.clip(hsv[:,:,1] + 50, 0, 255), hsv[:,:,1])
# Slightly increase value (brightness)
hsv[:,:,2] = np.where(mask > 0, np.clip(hsv[:,:,2] + 20, 0, 255), hsv[:,:,2])

res = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
cv2.imwrite('public/baskhedi_enhanced.jpeg', res)
print("Saved perfectly enhanced colored map with blue Nahar to baskhedi_enhanced.jpeg!")
