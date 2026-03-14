"""
Dexter's Lab — Vision Pipeline Backend

FastAPI + WebSocket server for:
  - Camera tracking (MediaPipe face/hand/pose)
  - Oracle response system (keyword → dystopian responses)

Streams real-time tracking data to the Next.js frontend via WebSocket.
Voice recognition is handled browser-side via the Web Speech API.
"""

import asyncio
import json
import time
import typing
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from vision.camera_tracker import CameraTracker
from vision.oracle import OracleResponseSystem

# ── Globals ──
camera_tracker: typing.Optional[CameraTracker] = None
oracle: typing.Optional[OracleResponseSystem] = None
connected_clients: typing.List[WebSocket] = []


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Start camera tracker on startup."""
    global camera_tracker, oracle

    oracle = OracleResponseSystem()

    # Camera
    camera_tracker = CameraTracker(camera_id=0, max_travel=200)
    camera_tracker.start()

    print("\n  🟢 Dexter's Lab backend ready.\n")
    yield

    if camera_tracker:
        camera_tracker.stop()
    print("  🔴 Backend shut down.")


app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:7777",
        "http://127.0.0.1:7777",
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://dexterslab.cclottaaworld.com",
        "https://dexterslab-api.cclottaaworld.com",
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
    print(f"  📡 Frontend connected ({len(connected_clients)} clients)")

    try:
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
        if ws in connected_clients:
            connected_clients.remove(ws)
        print(f"  📡 Frontend disconnected ({len(connected_clients)} clients)")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("server:app", host="0.0.0.0", port=8888, reload=False)
