#!/bin/bash
set -euo pipefail

TIMESTAMP=$(date +%s)
REPORT_DIR="field-test-reports/report-$TIMESTAMP"
mkdir -p "$REPORT_DIR"

echo "Collecting field test report into $REPORT_DIR..."

# 1. Copy PC diagnostic NDJSON
PC_DIAG_DIR="dexterslab-backend/diagnostics"
if ls "$PC_DIAG_DIR"/field-test-*.ndjson 1> /dev/null 2>&1; then
    cp "$PC_DIAG_DIR"/field-test-*.ndjson "$REPORT_DIR"/
else
    echo "No PC diagnostic logs found."
fi

# 2. SCP Pi diagnostic NDJSON via Tailscale SSH
PI_HOST="deploy@dexterslab-edge"
echo "Fetching Edge daemon logs..."
if ssh -q "$PI_HOST" "ls /home/deploy/dexterslab-edge/field-test-*.ndjson" >/dev/null 2>&1; then
    scp -q "$PI_HOST:/home/deploy/dexterslab-edge/field-test-*.ndjson" "$REPORT_DIR"/
else
    echo "No Pi diagnostic logs found or Pi offline."
fi

# 3. Copy Health snapshot
echo "Fetching health snapshot..."
curl -s http://localhost:8888/health > "$REPORT_DIR/health-snapshot.json" || echo "Failed to fetch health snapshot."

# 4. Copy backend PM2 logs
echo "Fetching PM2 logs..."
pm2 logs --lines 200 --raw --nostream > "$REPORT_DIR/backend-pm2-tail.txt" 2>/dev/null || echo "PM2 logs fetch failed."

# 5. Get Pi systemd journal
echo "Fetching Pi journal logs..."
ssh -q "$PI_HOST" "journalctl -n 200 --no-pager" > "$REPORT_DIR/pi-journal-tail.txt" 2>/dev/null || echo "Pi journal fetch failed."

# 6. Run analysis script
echo "Running analysis..."
node scripts/analyze-field-test.js "$REPORT_DIR" || echo "Analysis script failed."

echo "Report collected at: $REPORT_DIR/"
