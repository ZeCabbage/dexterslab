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
curl -fsSL https://tailscale.com/install.sh | sh
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

## Section 3: Tailscale Setup
- Run `sudo tailscale up` to authenticate your Pi to your Tailnet.
- To get the Tailscale IP (which will be populated in `.env` files):
```bash
tailscale ip -4
```

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
deploy ALL=(ALL) NOPASSWD: /bin/systemctl restart observer-capture.service
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
- Place the systemd service file:
```bash
sudo cp observer-capture.service /etc/systemd/system/
sudo systemctl daemon-reload
```
- Enable and start:
```bash
sudo systemctl enable observer-capture
sudo systemctl start observer-capture
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
- [ ] `curl http://localhost:8891/health` returns ok
- [ ] `sudo systemctl status observer-capture` shows active
- [ ] Video stream arriving on PC: Check PM2 logs or backend terminal for "Received stream..." or view the frontend feed.
- [ ] Audio stream arriving on PC: Ensure audio events are seen in PC backend via AudioIngress.
- [ ] TTS test: Connect to Pi WebSocket port 8892 and send `{"type":"speak","text":"Hello world"}` or use `/speaker-test` endpoint on backend.
- [ ] Chromium kiosk displays eye at `http://[PC_TAILSCALE_IP]:3000/observer/eye-v2`
