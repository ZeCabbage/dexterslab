#!/bin/bash
set -euo pipefail

log() { echo -e "\n→ $1"; }
success() { echo -e "✓ $1"; }
fail() { echo -e "✗ $1"; exit 1; }
warn() { echo -e "⚠ $1"; }

if [ $# -ne 1 ]; then
  echo "Usage: $0 [project-name]"
  exit 1
fi

PROJECT=$1

# 1. Validating project-name
if [[ ! "$PROJECT" =~ ^[a-z0-9\-]{3,20}$ ]]; then
  fail "Invalid project name '$PROJECT'. Must be 3-20 characters, lowercase letters, numbers, and hyphens only. No spaces, underscores, or capitals."
fi

FRONTEND_DIR="dexterslab-frontend/app/$PROJECT"
BACKEND_DIR="dexterslab-backend/$PROJECT"

if [ -d "$FRONTEND_DIR" ] || [ -d "$BACKEND_DIR" ]; then
  warn "Project '$PROJECT' already exists as a route or backend directory."
  warn "Exiting cleanly without duplicating files."
  exit 0
fi

# 2. Creating frontend scaffold
log "Creating frontend scaffold..."
mkdir -p "$FRONTEND_DIR"
cat << EOF > "$FRONTEND_DIR/page.tsx"
'use client';

import { useEffect } from 'react';
import { DisplayConnector } from '@/lib/observer2/display-connector';

export default function Page() {
  useEffect(() => {
    // const ws = new DisplayConnector();
    // ws.connect();
    // return () => ws.disconnect();
  }, []);

  return (
    <div style={{ color: 'white', padding: '2rem' }}>
      <h1>${PROJECT}</h1>
      <p>Scaffold generated. Connect to your backend via DisplayConnector.</p>
    </div>
  );
}
EOF
success "Frontend page.tsx created at $FRONTEND_DIR"

# 3. Creating backend scaffold
log "Creating backend scaffold..."
mkdir -p "$BACKEND_DIR"
# Remove hyphens for JS variable/class names
CLASS_PREFIX=$(echo "$PROJECT" | tr -d '-')
cat << EOF > "$BACKEND_DIR/${PROJECT}-server.js"
// ${PROJECT} WebSocket / API handler
class ${CLASS_PREFIX}Server {
  constructor(wss) {
    this.wss = wss;
    this.wss.on('connection', (ws) => {
      console.log('New ${PROJECT} connection');
      ws.on('message', (msg) => {
        console.log('${PROJECT} received:', msg.toString());
      });
    });
  }
}
module.exports = { ${CLASS_PREFIX}Server };
EOF

cat << EOF > "$BACKEND_DIR/README.md"
# ${PROJECT}

## Purpose
Document the purpose of this sub-project here.

## Data Flow
Pi Hardware → Edge Daemon → PC Backend → PC Frontend → Pi Display

## Port Registry
Document any dedicated ports used by this module.
EOF
success "Backend scaffold created at $BACKEND_DIR"

# 4. Updating the port registry
log "Updating port registry in .env.example..."
# Try to find .env.example
ENV_EXAMPLE="dexterslab-backend/.env.example"
if [ ! -f "$ENV_EXAMPLE" ]; then
  ENV_EXAMPLE=".env.example"
fi

if [ -f "$ENV_EXAMPLE" ]; then
  PROJECT_UPPER=$(echo "$PROJECT" | tr '[:lower:]' '[:upper:]')
  if ! grep -q "# ── ${PROJECT_UPPER}" "$ENV_EXAMPLE"; then
    echo -e "\n# ── ${PROJECT_UPPER} (add your ports below) ───────────────────" >> "$ENV_EXAMPLE"
    echo -e "# READ THIS CAREFULLY:" >> "$ENV_EXAMPLE"
    echo -e "# Before modifying this port, you MUST check the registry" >> "$ENV_EXAMPLE"
    echo -e "# at dexterslab/docs/port-registry.md or run /lab-status" >> "$ENV_EXAMPLE"
    echo -e "# Conflicts will cause silent edge daemon failures." >> "$ENV_EXAMPLE"
    success "Appended TODO comment to $ENV_EXAMPLE"
  else
    success "TODO comment already exists in $ENV_EXAMPLE"
  fi
else
  warn "Could not find .env.example to append port registry TODO."
fi

# 5. Printing next steps
echo ""
echo "New project scaffold created. Next steps:"
echo " 1. Add your port to .env.example"
echo " 2. Register your WebSocket path in server.js"
echo " 3. Add your route to the main dashboard in app/page.tsx"
echo " 4. Read: scripts/pi-setup-runbook.md if you need Pi hardware"

exit 0
