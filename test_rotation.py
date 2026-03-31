import cv2
import os

HAAR = 'models/haarcascade_frontalface_default.xml'
cascade = cv2.CascadeClassifier(HAAR)
idx = int(os.environ.get('CAMERA_INDEX', '0'))
cap = cv2.VideoCapture(idx)
if not cap.isOpened(): cap = cv2.VideoCapture(idx, cv2.CAP_V4L2)

if not cap.isOpened():
    print(f'Failed to open index {idx}')
    exit(1)

# burn a few frames for auto-exposure
for _ in range(10): cap.read()
ret, frame = cap.read()
cap.release()

if not ret or frame is None:
    print('Failed to read frame')
    exit(1)

def check_rot(img, label):
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    faces = cascade.detectMultiScale(gray, 1.2, 5)
    print(f'Rotation {label}: {len(faces)} faces found')

check_rot(frame, '0 deg (normal)')
f_90 = cv2.rotate(frame, cv2.ROTATE_90_CLOCKWISE)
check_rot(f_90, '90 deg clockwise')
f_180 = cv2.rotate(frame, cv2.ROTATE_180)
check_rot(f_180, '180 deg (upside down)')
f_270 = cv2.rotate(frame, cv2.ROTATE_90_COUNTERCLOCKWISE)
check_rot(f_270, '270 deg counter-clockwise')
