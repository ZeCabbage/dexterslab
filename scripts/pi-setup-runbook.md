# Pi Setup Runbook

This is a human-readable checklist for setting up a fresh Raspberry Pi as a dexterslab edge node.

## Section 1: Base OS Setup
- **Recommended OS:** Raspberry Pi OS Lite (64-bit, no desktop)
- **Required Hostname:** `dexterslab-pi`
- **Required User:** `deploy` (do not use default pi user!)

## Section 2: Required Package Installation
Run the following commands to install dependencies on the Pi:

```bash
sudo apt update
```
```bash
sudo apt install -y openssh-server
```
```bash
sudo apt install -y ffmpeg
```
```bash
sudo apt install -y espeak-ng
```
```bash
sudo apt install -y python3-pip python3-venv
```
```bash
sudo apt install -y portaudio19-dev libasound2-dev
```

## Section 3: Cloudflare Tunnel Setup (replaces Tailscale)

### 3a. Install cloudflared
```bash
curl -L --output cloudflared.deb https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64.deb
sudo dpkg -i cloudflared.deb
rm cloudflared.deb
```

### 3b. Authenticate cloudflared
```bash
cloudflared tunnel login
```
This opens a browser URL. Copy it to your PC/phone browser, log in to Cloudflare, and authorize the tunnel.

### 3c. Create the tunnel
```bash
cloudflared tunnel create dexterslab-pi
```
This creates a credentials file at `~/.cloudflared/<TUNNEL_ID>.json`. Note the Tunnel ID.

### 3d. Configure the tunnel
Create the config file:
```bash
mkdir -p ~/.cloudflared
nano ~/.cloudflared/config.yml
```

Paste this content (replace `<TUNNEL_ID>` with your actual ID):
```yaml
tunnel: <TUNNEL_ID>
credentials-file: /home/deploy/.cloudflared/<TUNNEL_ID>.json

ingress:
  - hostname: pi.dexterslab.cclottaaworld.com
    service: ssh://localhost:22
  - service: http_status:404
```

### 3e. Add DNS route
```bash
cloudflared tunnel route dns dexterslab-pi pi.dexterslab.cclottaaworld.com
```

### 3f. Install as systemd service
```bash
sudo cloudflared service install
sudo systemctl enable cloudflared
sudo systemctl start cloudflared
```

### 3g. Verify
```bash
sudo systemctl status cloudflared
```
Should show "active (running)".

## Section 4: Deploy User & SSH
- Creating the deploy user:
```bash
sudo adduser deploy
sudo usermod -aG sudo,video,audio deploy
```
- Switch to deploy: `su - deploy`
- Set up authorized_keys for SSH access:
```bash
mkdir -p ~/.ssh && chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys
# Paste your pc_to_pi_deploy.pub and dexterslab_pi_ed25519.pub keys here
chmod 600 ~/.ssh/authorized_keys
```
- Add the exact `sudoers` entry for passwordless service restarts (so deployment scripts don't hang):
```bash
sudo visudo
# Add at the bottom:
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart observer-boot.service, /bin/systemctl restart observer-capture.service, /bin/systemctl daemon-reload, /bin/systemctl enable observer-boot.service, /bin/systemctl disable observer-capture.service, /usr/bin/cp /home/deploy/dexterslab-edge/observer-boot.service /etc/systemd/system/
```
- Ensure permissions: `mkdir -p /home/deploy/dexterslab-edge/ && chown -R deploy:deploy /home/deploy/dexterslab-edge/`

## Section 5: Edge Daemon Installation
- **Note:** Git is NOT used on the Pi. The codebase is directly `rsync`ed from the PC edge daemon directory.
- Once rsync succeeds (see deploy script), SSH into the Pi and setup the venv:
```bash
cd ~/dexterslab-edge
python3 -m venv venv
```
- Install python requirements in venv:
```bash
./venv/bin/pip install -r requirements.txt
```
- Make boot scripts executable:
```bash
chmod +x boot-protocol.sh hw-discover.sh clean-shutdown.sh
```
- Place the systemd service file:
```bash
sudo cp observer-boot.service /etc/systemd/system/
sudo systemctl daemon-reload
```
- Disable old service and enable new:
```bash
sudo systemctl disable observer-capture 2>/dev/null || true
sudo systemctl enable observer-boot
sudo systemctl start observer-boot
```

## Section 6: Chromium Kiosk Setup
- **Note:** Only perform if using desktop OS variant instead of lite.
- Installing Chromium: `sudo apt install -y chromium-browser`
- The `observer-kiosk.sh` script is located at `scripts/observer-kiosk.sh` (copy it to `~/observer-kiosk.sh` for easy launch).
- Add the `.desktop` autostart entry to `~/.config/autostart/kiosk.desktop` (create dir if missing):
```ini
[Desktop Entry]
Type=Application
Name=Kiosk
Exec=/home/deploy/observer-kiosk.sh
X-GNOME-Autostart-enabled=true
```
- To test the kiosk without rebooting:
```bash
WAYLAND_DISPLAY=wayland-1 XDG_RUNTIME_DIR=/run/user/1000 ~/observer-kiosk.sh
# Adjust displays accordingly
```

## Section 7: Verification Checklist
- [ ] `sudo systemctl status cloudflared` shows active
- [ ] From PC: `ssh pi-deploy "echo ok"` connects successfully via Cloudflare Tunnel
- [ ] `curl http://localhost:8891/health` on Pi returns ok
- [ ] `cat /tmp/hw-manifest.json` shows discovered camera + audio devices
- [ ] `sudo systemctl status observer-boot` shows active
- [ ] Video stream arriving on PC: Check backend logs for `/ws/video` connection
- [ ] Audio stream arriving on PC: Check backend logs for `/ws/audio` connection
- [ ] TTS test: Send TTS command from PC dashboard, verify espeak-ng speaks on Pi
- [ ] Chromium kiosk displays eye at `https://dexterslab.cclottaaworld.com/observer/eye-v2`
- [ ] Reboot Pi and verify everything comes back automatically

