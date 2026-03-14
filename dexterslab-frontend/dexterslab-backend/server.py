"""
Dexter's Lab — Vision Pipeline Backend

FastAPI + WebSocket server for:
  - Camera tracking (MediaPipe face/hand/pose)
  - Voice recognition (Vosk)
  - Oracle response system (keyword → dystopian responses)

Streams real-time tracking data to the Next.js frontend via WebSocket.
"""

import asyncio
import json
import time
import typing
from contextlib import asynccontextmanager
from concurrent.futures import ThreadPoolExecutor

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vision.camera_tracker import CameraTracker
from vision.voice_listener import VoiceListener
from vision.oracle import OracleResponseSystem

# ── Globals ──
camera_tracker: typing.Optional[CameraTracker] = None
voice_listener: typing.Optional[VoiceListener] = None
oracle: typing.Optional[OracleResponseSystem] = None
connected_clients: typing.List[WebSocket] = []

voice_event_queue: asyncio.Queue = asyncio.Queue()
client_queues: typing.Dict[WebSocket, asyncio.Queue] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start camera tracker and voice listener on startup."""
    global camera_tracker, voice_listener, oracle

    oracle = OracleResponseSystem()

    # Camera
    camera_tracker = CameraTracker(camera_id=0, max_travel=200)
    camera_tracker.start()

    # Event loop for thread-safe queue puts
    loop = asyncio.get_running_loop()

    def _enqueue(event: dict):
        try:
            loop.call_soon_threadsafe(voice_event_queue.put_nowait, event)
        except Exception:
            pass

    oracle_pool = ThreadPoolExecutor(max_workers=2, thread_name_prefix="oracle")

    def on_speech(text: str):
        def _process():
            result = oracle.process(text)
            if result:
                _enqueue({
                    "type": "oracle_response",
                    "text": text,
                    "response": result["response"],
                    "category": result["category"],
                })
        oracle_pool.submit(_process)

    def on_command(cmd: str):
        print(f"  [Server] Command: {cmd}")
        _enqueue({"type": "voice_command", "command": cmd})

    def on_partial(text: str):
        _enqueue({"type": "voice_partial", "text": text})

    voice_listener = VoiceListener(
        on_speech=on_speech, on_command=on_command, on_partial=on_partial
    )
    voice_listener.start()

    # Broadcaster
    async def broadcaster():
        while True:
            event = await voice_event_queue.get()
            dead = []
            for ws, q in client_queues.items():
                try:
                    q.put_nowait(event)
                except Exception:
                    dead.append(ws)
            for ws in dead:
                client_queues.pop(ws, None)

    broadcast_task = asyncio.create_task(broadcaster())

    print("\n  🟢 Dexter's Lab backend ready.\n")
    yield

    broadcast_task.cancel()
    if camera_tracker:
        camera_tracker.stop()
    if voice_listener:
        voice_listener.stop()
    print("  🔴 Backend shut down.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "https://thecabbagepatch.cclottaworld.com",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── REST Endpoints ──

class OracleRequest(BaseModel):
    text: str

@app.post("/api/oracle")
async def oracle_endpoint(req: OracleRequest):
    if not oracle:
        return {"error": "Oracle not initialized"}
    result = oracle.process(req.text)
    if result:
        return result
    return {"response": None, "category": None}

@app.get("/api/oracle/ambient")
async def oracle_ambient():
    if not oracle:
        return {"phrase": "SURVEILLANCE ACTIVE"}
    return {"phrase": oracle.get_ambient_phrase()}

@app.get("/api/health")
async def health():
    return {"status": "ok", "camera": camera_tracker is not None}


# ── WebSocket ──

@app.websocket("/ws")
async def websocket_endpoint(ws: WebSocket):
    await ws.accept()
    connected_clients.append(ws)
    my_queue: asyncio.Queue = asyncio.Queue()
    client_queues[ws] = my_queue
    print(f"  📡 Frontend connected ({len(connected_clients)} clients)")

    try:
        async def send_voice_events():
            while True:
                event = await my_queue.get()
                try:
                    await ws.send_json(event)
                except WebSocketDisconnect:
                    break

        voice_task = asyncio.create_task(send_voice_events())

        while True:
            if camera_tracker:
                state = camera_tracker.get_state()
                await ws.send_json({"type": "tracking", **state})
            await asyncio.sleep(0.033)

    except WebSocketDisconnect:
        pass
    except Exception as e:
        print(f"  WebSocket error: {e}")
    finally:
        voice_task.cancel()
        client_queues.pop(ws, None)
        if ws in connected_clients:
            connected_clients.remove(ws)
        print(f"  📡 Frontend disconnected ({len(connected_clients)} clients)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8888, reload=False)
