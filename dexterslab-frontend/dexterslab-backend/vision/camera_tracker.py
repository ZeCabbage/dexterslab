"""
CameraTracker — MediaPipe-based real-time face/hand/pose tracking.

Runs in a background thread. Provides normalized eye-tracking coordinates,
pupil dilation, and object detection results via get_state().
Optimized for Raspberry Pi 5.
"""

import threading
import time
from typing import Optional, Dict, Any, List

import cv2
import numpy as np


class CameraTracker:
    """Background camera tracking using MediaPipe."""

    def __init__(self, camera_id: int = 0, max_travel: float = 200.0):
        self.camera_id = camera_id
        self.max_travel = max_travel
        self._running = False
        self._thread: Optional[threading.Thread] = None

        # Current state (thread-safe via GIL for simple reads)
        self._state: Dict[str, Any] = {
            "x": 0.0,
            "y": 0.0,
            "smooth": 0.15,
            "dilation": 1.0,
            "visible": False,
            "objects": [],
        }

    def start(self):
        """Start the camera tracker in a background thread."""
        if self._running:
            return
        self._running = True
        self._thread = threading.Thread(target=self._run, daemon=True, name="CameraTracker")
        self._thread.start()

    def stop(self):
        """Stop the camera tracker."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=5)
            self._thread = None

    def get_state(self) -> Dict[str, Any]:
        """Return current tracking state."""
        return dict(self._state)

    def _run(self):
        """Main tracker loop — runs in background thread."""
        try:
            import mediapipe as mp
        except ImportError:
            print("  ⚠️ CameraTracker: mediapipe not installed")
            return

        mp_face = mp.solutions.face_detection
        mp_hands = mp.solutions.hands

        cap = cv2.VideoCapture(self.camera_id)
        if not cap.isOpened():
            print(f"  ⚠️ CameraTracker: Cannot open camera {self.camera_id}")
            return

        # Lower resolution for Pi performance
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

        print(f"  📷 CameraTracker ready (camera={self.camera_id})")

        face_detection = mp_face.FaceDetection(
            model_selection=0,  # Short range (< 2m)
            min_detection_confidence=0.5,
        )
        hands = mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=2,
            min_detection_confidence=0.5,
            min_tracking_confidence=0.4,
        )

        frame_count = 0
        last_fps_time = time.time()

        try:
            while self._running:
                ret, frame = cap.read()
                if not ret:
                    time.sleep(0.01)
                    continue

                frame_count += 1
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                h, w = frame.shape[:2]

                objects: List[Dict[str, Any]] = []
                visible = False
                target_x = 0.0
                target_y = 0.0
                dilation = 1.0

                # Face detection
                face_results = face_detection.process(rgb)
                if face_results.detections:
                    # Track the largest face
                    best = max(face_results.detections, key=lambda d: d.score[0])
                    bb = best.location_data.relative_bounding_box
                    face_cx = bb.xmin + bb.width / 2
                    face_cy = bb.ymin + bb.height / 2

                    # Normalize to eye coordinates (-max_travel to +max_travel)
                    target_x = (face_cx - 0.5) * 2.0 * self.max_travel
                    target_y = (face_cy - 0.5) * 2.0 * self.max_travel * -1  # Invert Y

                    # Dilation based on face size (closer = more dilation)
                    face_area = bb.width * bb.height
                    dilation = 0.8 + face_area * 3.0
                    dilation = max(0.6, min(1.5, dilation))

                    visible = True
                    objects.append({"label": "face", "score": float(best.score[0])})

                # Hand detection (every 3rd frame for performance)
                if frame_count % 3 == 0:
                    hand_results = hands.process(rgb)
                    if hand_results.multi_hand_landmarks:
                        for hand_landmarks in hand_results.multi_hand_landmarks:
                            wrist = hand_landmarks.landmark[0]
                            objects.append({
                                "label": "hand",
                                "score": 0.8,
                            })
                            if not visible:
                                target_x = (wrist.x - 0.5) * 2.0 * self.max_travel
                                target_y = (wrist.y - 0.5) * 2.0 * self.max_travel * -1
                                visible = True

                self._state = {
                    "x": round(target_x, 1),
                    "y": round(target_y, 1),
                    "smooth": 0.15,
                    "dilation": round(dilation, 3),
                    "visible": visible,
                    "objects": objects,
                }

                # Throttle to ~30fps
                time.sleep(0.025)

        finally:
            cap.release()
            face_detection.close()
            hands.close()
            print("  📷 CameraTracker stopped")
