#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" &> /dev/null && pwd)"

usage() {
  echo "Usage: $0 [backend|frontend|pi|all]"
  exit 1
}

if [ $# -eq 0 ]; then
  usage
fi

TARGET=$1

case "$TARGET" in
  backend)
    bash "$SCRIPT_DIR/deploy-backend.sh"
    ;;
  frontend)
    bash "$SCRIPT_DIR/deploy-frontend.sh"
    ;;
  pi)
    bash "$SCRIPT_DIR/deploy-to-pi.sh"
    ;;
  all)
    bash "$SCRIPT_DIR/deploy-backend.sh"
    bash "$SCRIPT_DIR/deploy-frontend.sh"
    bash "$SCRIPT_DIR/deploy-to-pi.sh"
    ;;
  *)
    usage
    ;;
esac
