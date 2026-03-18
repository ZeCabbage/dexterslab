#!/bin/bash
# ═══════════════════════════════════════════
# DEXTER'S LAB — Dev Environment Startup
# Starts backend (port 8888) + frontend (port 7777)
# ═══════════════════════════════════════════

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_DIR="$SCRIPT_DIR/dexterslab-backend"
FRONTEND_DIR="$SCRIPT_DIR/dexterslab-frontend"

# Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
RED='\033[0;31m'
AMBER='\033[0;33m'
NC='\033[0m'

echo ""
echo -e "${CYAN}  ╔═══════════════════════════════════════════╗${NC}"
echo -e "${CYAN}  ║       DEXTER'S LAB — Dev Environment      ║${NC}"
echo -e "${CYAN}  ╚═══════════════════════════════════════════╝${NC}"
echo ""

# Cleanup on exit
cleanup() {
  echo ""
  echo -e "${AMBER}  Shutting down...${NC}"
  kill $BACKEND_PID 2>/dev/null
  kill $FRONTEND_PID 2>/dev/null
  wait $BACKEND_PID 2>/dev/null
  wait $FRONTEND_PID 2>/dev/null
  echo -e "${GREEN}  All processes stopped.${NC}"
  exit 0
}
trap cleanup SIGINT SIGTERM

# Check dependencies
if [ ! -d "$BACKEND_DIR/node_modules" ]; then
  echo -e "${AMBER}  Installing backend dependencies...${NC}"
  (cd "$BACKEND_DIR" && npm install)
fi

if [ ! -d "$FRONTEND_DIR/node_modules" ]; then
  echo -e "${AMBER}  Installing frontend dependencies...${NC}"
  (cd "$FRONTEND_DIR" && npm install)
fi

# Start backend
echo -e "${GREEN}  Starting backend server (port 8888)...${NC}"
# Auto-detect platform
if [[ "$(uname)" == "Darwin" ]]; then
  DETECT_PLATFORM="mac"
elif grep -q "Raspberry" /proc/cpuinfo 2>/dev/null; then
  DETECT_PLATFORM="pi"
else
  DETECT_PLATFORM="linux"
fi
(cd "$BACKEND_DIR" && PLATFORM="${PLATFORM:-$DETECT_PLATFORM}" npm run dev) &
BACKEND_PID=$!

# Wait a moment for backend to start
sleep 2

# Start frontend
echo -e "${GREEN}  Starting frontend dev server (port 7777)...${NC}"
(cd "$FRONTEND_DIR" && npm run dev) &
FRONTEND_PID=$!

echo ""
echo -e "${CYAN}  ┌─────────────────────────────────────────┐${NC}"
echo -e "${CYAN}  │  Backend:  http://localhost:8888         │${NC}"
echo -e "${CYAN}  │  Frontend: http://localhost:7777         │${NC}"
echo -e "${CYAN}  │  Hub:      http://localhost:7777/observer│${NC}"
echo -e "${CYAN}  │                                         │${NC}"
echo -e "${CYAN}  │  Press Ctrl+C to stop all servers       │${NC}"
echo -e "${CYAN}  └─────────────────────────────────────────┘${NC}"
echo ""

# Wait for either to exit
wait
