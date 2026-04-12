#!/usr/bin/env python3
"""
Deadswitch — Offline Survival Oracle Daemon

Runs entirely on the Raspberry Pi.  Pipeline:
  Vosk STT → BM25 retrieval → Ollama LLM → espeak-ng TTS

Falls back to raw retrieval if Ollama is unavailable.

WebSocket server (:8893) pushes real-time state to the display.
"""

import os
import sys
import json
import glob
import time
import asyncio
import re
import subprocess
import signal
from pathlib import Path

try:
    from rank_bm25 import BM25Okapi
except ImportError:
    print("[Deadswitch] rank-bm25 not installed — run: pip install rank-bm25")
    sys.exit(1)

try:
    import websockets
    from websockets.server import serve as ws_serve
except ImportError:
    print("[Deadswitch] websockets not installed — run: pip install websockets")
    sys.exit(1)

# ─── Configuration ────────────────────────────────────────
KNOWLEDGE_DIR = os.environ.get(
    "DEADSWITCH_KNOWLEDGE",
    os.path.join(os.path.dirname(__file__), "knowledge")
)
OLLAMA_HOST = os.environ.get("OLLAMA_HOST", "http://127.0.0.1:11434")
OLLAMA_MODEL = os.environ.get("DEADSWITCH_MODEL", "qwen3:0.6b")
WS_PORT = int(os.environ.get("DEADSWITCH_WS_PORT", "8893"))
CHUNK_SIZE = 600      # Max characters per retrieval chunk
TOP_K = 3             # Number of chunks to retrieve
VOSK_MODEL = os.environ.get("VOSK_MODEL", "/home/pi/vosk-model-small-en-us-0.15")

# ─── State ────────────────────────────────────────────────
state = {
    "status": "idle",
    "query": "",
    "answer": "",
    "sources": [],
    "ollamaOnline": False,
    "knowledgeFiles": 0,
    "lastQuery": None,
}

ws_clients = set()

# ─── BM25 Knowledge Index ────────────────────────────────

def chunk_markdown(text, source_file, chunk_size=CHUNK_SIZE):
    """Split markdown into retrievable chunks by section headers."""
    chunks = []
    current_header = source_file
    current_text = []

    for line in text.split('\n'):
        if line.startswith('## '):
            # Save previous chunk
            if current_text:
                body = '\n'.join(current_text).strip()
                if body:
                    chunks.append({
                        "header": current_header,
                        "text": body,
                        "source": source_file,
                    })
            current_header = line.lstrip('#').strip()
            current_text = []
        else:
            current_text.append(line)

    # Final chunk
    if current_text:
        body = '\n'.join(current_text).strip()
        if body:
            chunks.append({
                "header": current_header,
                "text": body,
                "source": source_file,
            })

    # Split oversized chunks
    final = []
    for c in chunks:
        if len(c["text"]) <= chunk_size:
            final.append(c)
        else:
            words = c["text"].split()
            buf = []
            for w in words:
                buf.append(w)
                if len(' '.join(buf)) > chunk_size:
                    final.append({
                        "header": c["header"],
                        "text": ' '.join(buf),
                        "source": c["source"],
                    })
                    buf = []
            if buf:
                final.append({
                    "header": c["header"],
                    "text": ' '.join(buf),
                    "source": c["source"],
                })
    return final


def build_index():
    """Load all markdown files and build BM25 index."""
    md_files = sorted(glob.glob(os.path.join(KNOWLEDGE_DIR, "*.md")))
    all_chunks = []
    for fpath in md_files:
        with open(fpath, 'r', encoding='utf-8') as f:
            text = f.read()
        fname = os.path.basename(fpath)
        all_chunks.extend(chunk_markdown(text, fname))

    if not all_chunks:
        print("[Deadswitch] WARNING: No knowledge files found!")
        return [], None

    # Tokenize for BM25
    tokenized = [
        re.findall(r'\w+', (c["header"] + " " + c["text"]).lower())
        for c in all_chunks
    ]
    bm25 = BM25Okapi(tokenized)

    print(f"[Deadswitch] Indexed {len(all_chunks)} chunks from {len(md_files)} files")
    state["knowledgeFiles"] = len(md_files)
    return all_chunks, bm25


def retrieve(query, chunks, bm25, top_k=TOP_K):
    """Retrieve top-k most relevant chunks for a query."""
    if not bm25 or not chunks:
        return []
    tokens = re.findall(r'\w+', query.lower())
    scores = bm25.get_scores(tokens)
    ranked_indices = sorted(range(len(scores)), key=lambda i: scores[i], reverse=True)
    results = []
    for idx in ranked_indices[:top_k]:
        if scores[idx] > 0:
            c = chunks[idx]
            results.append({
                "header": c["header"],
                "text": c["text"][:CHUNK_SIZE],
                "source": c["source"],
                "score": round(float(scores[idx]), 2),
            })
    return results


# ─── Ollama Client ────────────────────────────────────────

async def check_ollama():
    """Check if Ollama is reachable."""
    try:
        proc = await asyncio.create_subprocess_exec(
            "curl", "-s", "-o", "/dev/null", "-w", "%{http_code}",
            f"{OLLAMA_HOST}/api/tags",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, _ = await asyncio.wait_for(proc.communicate(), timeout=5)
        code = stdout.decode().strip()
        state["ollamaOnline"] = code == "200"
    except Exception:
        state["ollamaOnline"] = False
    return state["ollamaOnline"]


async def generate_answer(query, context_chunks):
    """Call Ollama to generate an answer from retrieved context."""
    if not state["ollamaOnline"]:
        return None

    context = "\n\n---\n\n".join([
        f"[{c['source']} — {c['header']}]\n{c['text']}"
        for c in context_chunks
    ])

    prompt = f"""You are Deadswitch, an offline survival knowledge assistant.
Answer the user's question using ONLY the provided reference material.
Be practical, specific, and concise. Include exact measurements, ratios, and steps.
If the reference material does not contain the answer, say so honestly.

REFERENCE MATERIAL:
{context}

USER QUESTION: {query}

ANSWER:"""

    try:
        import urllib.request
        req_data = json.dumps({
            "model": OLLAMA_MODEL,
            "prompt": prompt,
            "stream": False,
            "options": {
                "temperature": 0.3,
                "num_predict": 512,
            }
        }).encode('utf-8')

        req = urllib.request.Request(
            f"{OLLAMA_HOST}/api/generate",
            data=req_data,
            headers={"Content-Type": "application/json"},
        )

        with urllib.request.urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode())
            return result.get("response", "").strip()
    except Exception as e:
        print(f"[Deadswitch] Ollama error: {e}")
        state["ollamaOnline"] = False
        return None


# ─── TTS ──────────────────────────────────────────────────

def speak(text):
    """Speak text using espeak-ng."""
    try:
        # Truncate for TTS — keep it to a reasonable spoken length
        short = text[:500] if len(text) > 500 else text
        subprocess.Popen(
            ["espeak-ng", "-v", "en+m3", "-s", "140", "-a", "80", short],
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
    except FileNotFoundError:
        print("[Deadswitch] espeak-ng not found — TTS disabled")


# ─── WebSocket State Broadcasting ─────────────────────────

async def broadcast_state():
    """Push current state to all connected display clients."""
    msg = json.dumps({"type": "state", "data": state})
    gone = set()
    for ws in ws_clients:
        try:
            await ws.send(msg)
        except Exception:
            gone.add(ws)
    ws_clients -= gone


async def ws_handler(ws):
    """Handle new WS connections from the display frontend."""
    ws_clients.add(ws)
    print(f"[Deadswitch] Display connected (clients: {len(ws_clients)})")
    try:
        await ws.send(json.dumps({"type": "state", "data": state}))
        async for raw in ws:
            try:
                msg = json.loads(raw)
                if msg.get("type") == "query" and msg.get("text"):
                    await process_query(msg["text"])
                elif msg.get("type") == "ping":
                    await ws.send(json.dumps({"type": "pong"}))
            except json.JSONDecodeError:
                pass
    except websockets.exceptions.ConnectionClosed:
        pass
    finally:
        ws_clients.discard(ws)
        print(f"[Deadswitch] Display disconnected (clients: {len(ws_clients)})")


# ─── Main RAG Pipeline ────────────────────────────────────

chunks = []
bm25_index = None

async def process_query(query_text):
    """Full RAG pipeline: retrieve → generate → speak."""
    global state

    state["query"] = query_text
    state["answer"] = ""
    state["sources"] = []
    state["status"] = "retrieving"
    state["lastQuery"] = query_text
    await broadcast_state()

    # Step 1: Retrieve
    results = retrieve(query_text, chunks, bm25_index)
    state["sources"] = [r["source"] for r in results]

    if not results:
        state["status"] = "error"
        state["answer"] = "No relevant information found in the archives."
        await broadcast_state()
        speak(state["answer"])
        await asyncio.sleep(5)
        state["status"] = "idle"
        await broadcast_state()
        return

    # Step 2: Generate (or fallback to raw retrieval)
    state["status"] = "generating"
    await broadcast_state()

    answer = await generate_answer(query_text, results)

    if answer:
        state["answer"] = answer
    else:
        # Fallback: raw retrieval
        state["status"] = "error"
        fallback = "\n\n".join([
            f"[{r['header']}]\n{r['text']}"
            for r in results
        ])
        state["answer"] = f"⚠ AI engine offline. Raw archive result:\n\n{fallback}"

    await broadcast_state()

    # Step 3: Speak
    state["status"] = "speaking"
    await broadcast_state()
    speak(state["answer"])

    # Wait for TTS then reset
    word_count = len(state["answer"].split())
    speak_time = max(3, word_count / 2.5)  # rough estimate
    await asyncio.sleep(speak_time)

    state["status"] = "idle"
    await broadcast_state()


# ─── Vosk STT Listener ────────────────────────────────────

async def audio_listener():
    """Listen for voice queries using Vosk STT."""
    try:
        import vosk
        import sounddevice as sd
    except ImportError as e:
        print(f"[Deadswitch] STT dependencies missing ({e}) — voice input disabled")
        return

    if not os.path.exists(VOSK_MODEL):
        print(f"[Deadswitch] Vosk model not found at {VOSK_MODEL} — voice input disabled")
        return

    model = vosk.Model(VOSK_MODEL)
    rec = vosk.KaldiRecognizer(model, 16000)

    print("[Deadswitch] Voice listener started")

    q = asyncio.Queue()

    def audio_callback(indata, frames, time_info, audio_status):
        q.put_nowait(bytes(indata))

    with sd.RawInputStream(samplerate=16000, blocksize=4000, dtype='int16',
                           channels=1, callback=audio_callback):
        silence_count = 0
        while True:
            data = await q.get()
            if state["status"] != "idle":
                continue  # Don't listen while processing

            if rec.AcceptWaveform(data):
                result = json.loads(rec.Result())
                text = result.get("text", "").strip()
                if text and len(text) > 3:
                    print(f"[Deadswitch] Voice query: '{text}'")
                    state["status"] = "listening"
                    await broadcast_state()
                    await asyncio.sleep(0.5)
                    await process_query(text)


# ─── Health Check Loop ────────────────────────────────────

async def health_loop():
    """Periodically check Ollama status and broadcast state."""
    while True:
        await check_ollama()
        await broadcast_state()
        await asyncio.sleep(30)


# ─── Main ─────────────────────────────────────────────────

async def main():
    global chunks, bm25_index

    print("=" * 50)
    print("  DEADSWITCH — Offline Survival Oracle")
    print("=" * 50)

    # Build knowledge index
    chunks, bm25_index = build_index()

    # Check Ollama
    await check_ollama()
    if state["ollamaOnline"]:
        print(f"[Deadswitch] Ollama online — model: {OLLAMA_MODEL}")
    else:
        print(f"[Deadswitch] Ollama offline — will use raw retrieval fallback")

    # Start WebSocket server
    print(f"[Deadswitch] WebSocket server on port {WS_PORT}")

    async with ws_serve(ws_handler, "0.0.0.0", WS_PORT):
        # Start background tasks
        tasks = [
            asyncio.create_task(health_loop()),
            asyncio.create_task(audio_listener()),
        ]

        print("[Deadswitch] System ready. Awaiting queries...")
        print()

        try:
            await asyncio.gather(*tasks)
        except asyncio.CancelledError:
            pass

    print("[Deadswitch] Shutdown complete")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\n[Deadswitch] Interrupted — shutting down")
