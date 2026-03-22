/**
 * useMotionTracking — Connects to the Pi's camera-tracker service (WebSocket on port 8765)
 * and feeds tracked entities through the GazeController for lifelike eye behavior.
 *
 * Architecture:
 *   Pi camera-tracker.js (ffmpeg V4L2 → motion detection → entity tracking)
 *     → WebSocket ws://localhost:8765
 *       → this hook (entity data → GazeController → eye gaze target)
 *
 * Falls back to sentinel mode if tracker service is unavailable.
 */

import { useEffect, useRef, useCallback } from 'react';
import { GazeController, GazeTarget, MotionEntity } from '@/lib/gaze-controller';

export interface MotionTrackingCallbacks {
    onGazeUpdate: (gaze: GazeTarget) => void;
}

const TRACKER_URL = 'ws://localhost:8765';
const RECONNECT_DELAY = 3000;

export function useMotionTracking({ onGazeUpdate }: MotionTrackingCallbacks) {
    const callbackRef = useRef(onGazeUpdate);
    callbackRef.current = onGazeUpdate;

    const wsRef = useRef<WebSocket | null>(null);
    const gazeControllerRef = useRef<GazeController | null>(null);
    const activeRef = useRef(true);
    const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const connect = useCallback(() => {
        if (!activeRef.current) return;

        // Initialize gaze controller on first connection
        if (!gazeControllerRef.current) {
            gazeControllerRef.current = new GazeController();
        }

        console.log('👁 Connecting to camera tracker...');

        try {
            const ws = new WebSocket(TRACKER_URL);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('👁 Connected to camera tracker ✅');
            };

            ws.onmessage = (event) => {
                try {
                    const data = JSON.parse(event.data);
                    if (data.type === 'tracking' && data.entities) {
                        const entities: MotionEntity[] = data.entities;
                        const gaze = gazeControllerRef.current!.update(entities);
                        callbackRef.current(gaze);
                    }
                } catch {
                    // ignore parse errors
                }
            };

            ws.onclose = () => {
                console.log('👁 Camera tracker disconnected — retrying...');
                wsRef.current = null;
                // Send idle gaze
                const gaze = gazeControllerRef.current!.update([]);
                callbackRef.current(gaze);
                // Reconnect
                if (activeRef.current) {
                    reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
                }
            };

            ws.onerror = () => {
                // onclose will fire after this
                ws.close();
            };
        } catch {
            console.log('👁 Camera tracker not available — sentinel mode');
            // Send idle gaze
            if (gazeControllerRef.current) {
                const gaze = gazeControllerRef.current.update([]);
                callbackRef.current(gaze);
            }
            if (activeRef.current) {
                reconnectTimerRef.current = setTimeout(connect, RECONNECT_DELAY);
            }
        }
    }, []);

    useEffect(() => {
        activeRef.current = true;
        connect();

        return () => {
            activeRef.current = false;
            if (reconnectTimerRef.current) {
                clearTimeout(reconnectTimerRef.current);
            }
            if (wsRef.current) {
                wsRef.current.close();
                wsRef.current = null;
            }
            console.log('👁 Motion tracking stopped');
        };
    }, [connect]);
}
