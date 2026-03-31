import cv2
import time

cap = cv2.VideoCapture(0)
if not cap.isOpened(): cap = cv2.VideoCapture(0, cv2.CAP_V4L2)

cap.set(cv2.CAP_PROP_FRAME_WIDTH,320)
cap.set(cv2.CAP_PROP_FRAME_HEIGHT,240)

# Warm up
for _ in range(10): 
    cap.read()
    time.sleep(0.1)
    
ret, frame = cap.read()
if ret and frame is not None:
    cv2.imwrite('/tmp/cam0.jpg', frame)
    print("Frame saved to /tmp/cam0.jpg")
else:
    print("Failed to capture frame")
cap.release()
