import cv2
import sys

print('--- Camera Test ---')
working = []

for i in range(5):
    cap = cv2.VideoCapture(i)
    if not cap.isOpened():
        cap = cv2.VideoCapture(i, cv2.CAP_V4L2)

    if cap.isOpened():
        ret, frame = cap.read()
        if ret and frame is not None:
            print(f'Camera Index {i} is WORKING and successfully fetched a frame.')
            working.append(i)
        else:
            print(f'Camera Index {i} opened, but NO FRAME could be read.')
        cap.release()
    else:
        print(f'Camera Index {i} could not be opened.')

sys.exit(0 if working else 1)
