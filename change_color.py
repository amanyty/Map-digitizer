import cv2
import numpy as np

img = cv2.imread('public/baskhedi_stylized_map.png')
hsv = cv2.cvtColor(img, cv2.COLOR_BGR2HSV)

# Define range for brown color in HSV
# Hue for brown is 10-30. We want to target the dark brown sketch pen.
lower_brown = np.array([5, 40, 20])
upper_brown = np.array([35, 255, 180])

mask = cv2.inRange(hsv, lower_brown, upper_brown)

# Change hue of masked pixels to blue (Hue 115)
hsv[:,:,0] = np.where(mask > 0, 115, hsv[:,:,0])
# Boost saturation so it looks like a blue sketch pen
hsv[:,:,1] = np.where(mask > 0, np.clip(hsv[:,:,1] + 50, 0, 255), hsv[:,:,1])
# Slightly increase value (brightness) to make it look like water
hsv[:,:,2] = np.where(mask > 0, np.clip(hsv[:,:,2] + 20, 0, 255), hsv[:,:,2])

res = cv2.cvtColor(hsv, cv2.COLOR_HSV2BGR)
cv2.imwrite('public/baskhedi_stylized_map.png', res)
print("Changed brown to blue.")
