import time
import json
import threading
import os
import re

try:
    import psutil
except ImportError:
    psutil = None

log_file = None
log_path = None
event_count = 0
events_last_10s = 0

video_frames_sent_total = 0
video_frames_last_10s = 0
audio_chunks_sent_total = 0
tts_commands_received_total = 0
_last_frame_seen = 0

_metrics_thread = None

def log_event(data):
    global log_file
    if log_file:
        try:
            log_file.write(json.dumps(data) + '\n')
            log_file.flush()
        except:
            pass

def metrics_loop():
    global video_frames_last_10s, event_count, events_last_10s
    while True:
        time.sleep(10.0)
        
        cpu_percent = None
        memory_mb = None
        if psutil:
            try:
                cpu_percent = psutil.cpu_percent()
                memory_mb = psutil.virtual_memory().used / 1048576
            except:
                pass
                
        event_count += 1
        snapshot = {
            "seq": event_count,
            "ts": int(time.time() * 1000),
            "type": "metrics_snapshot",
            "data": {
                "video_frames_sent_total": video_frames_sent_total,
                "video_fps_actual": video_frames_last_10s / 10.0,
                "audio_chunks_sent_total": audio_chunks_sent_total,
                "tts_commands_received_total": tts_commands_received_total,
                "cpu_percent": cpu_percent,
                "memory_mb": memory_mb
            }
        }
        log_event(snapshot)
        video_frames_last_10s = 0

def attach(video_streamer, audio_streamer, tts_receiver):
    global log_file, log_path, _metrics_thread, event_count
    if log_file:
        return
        
    log_path = os.path.join(os.path.dirname(__file__), f"field-test-edge-{int(time.time() * 1000)}.ndjson")
    log_file = open(log_path, 'a')
    
    if video_streamer:
        import video_streamer as vs_module
        orig_debug = vs_module.logger.debug
        def patched_debug(msg, *args, **kwargs):
            orig_debug(msg, *args, **kwargs)
            if "[ffmpeg]" in str(msg) and "frame=" in str(msg):
                global video_frames_sent_total, video_frames_last_10s, event_count, _last_frame_seen
                match = re.search(r'frame=\s*(\d+)', str(msg))
                if match:
                    current_frame = int(match.group(1))
                    diff = current_frame - _last_frame_seen
                    if 0 < diff < 500:
                        video_frames_sent_total += diff
                        video_frames_last_10s += diff
                        _last_frame_seen = current_frame
                        
                        event_count += 1
                        log_event({
                            "seq": event_count,
                            "ts": int(time.time() * 1000),
                            "component": "video_streamer",
                            "event": "frame_sent",
                            "detail": f"batch {diff}"
                        })
        vs_module.logger.debug = patched_debug
    
    if audio_streamer:
        orig_get = audio_streamer._queue.get
        def patched_get(*args, **kwargs):
            res = orig_get(*args, **kwargs)
            global audio_chunks_sent_total, event_count
            audio_chunks_sent_total += 1
            event_count += 1
            log_event({
                "seq": event_count,
                "ts": int(time.time() * 1000),
                "component": "audio_streamer",
                "event": "audio_chunk_sent",
                "detail": ""
            })
            return res
        audio_streamer._queue.get = patched_get
        
    if tts_receiver:
        orig_speak = tts_receiver._speak
        def patched_speak(text):
            global tts_commands_received_total, event_count
            tts_commands_received_total += 1
            event_count += 1
            log_event({
                "seq": event_count,
                "ts": int(time.time() * 1000),
                "component": "tts_receiver",
                "event": "tts_received",
                "detail": text[:40]
            })
            return orig_speak(text)
        tts_receiver._speak = patched_speak

    _metrics_thread = threading.Thread(target=metrics_loop, daemon=True)
    _metrics_thread.start()
