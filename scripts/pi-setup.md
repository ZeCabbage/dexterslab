# Raspberry Pi — Observer Hub Kiosk Setup

How to make your Raspberry Pi boot directly into the Observer Hub on the circular display.

## Prerequisites

- Raspberry Pi 5 with desktop environment (Wayland/X11)
- Chromium browser installed (`sudo apt install chromium-browser`)
- `unclutter` for hiding the cursor (`sudo apt install unclutter`)
- Node.js 18+ and npm installed
- The `dexterslab` repo cloned at `/home/thecabbage/Desktop/dexterslab`

## Step 1: Install Dependencies

```bash
sudo apt install -y chromium-browser unclutter
```

## Step 2: Create the Next.js Systemd Service

This ensures the frontend and backend start on boot, **before** Chromium launches.

```bash
sudo tee /etc/systemd/system/dexterslab.service > /dev/null << 'EOF'
[Unit]
Description=Dexter's Lab - Frontend & Backend
After=network.target

[Service]
Type=simple
User=thecabbage
WorkingDirectory=/home/thecabbage/Desktop/dexterslab
ExecStart=/bin/bash -c 'cd dexterslab-backend && npm run start & cd dexterslab-frontend && npm run start:local'
Restart=on-failure
RestartSec=5
Environment=NODE_ENV=production
Environment=PORT=8888

[Install]
WantedBy=multi-user.target
EOF
```

Enable and start:

```bash
sudo systemctl daemon-reload
sudo systemctl enable dexterslab.service
sudo systemctl start dexterslab.service
```

## Step 3: Make the Kiosk Script Executable

```bash
chmod +x /home/thecabbage/Desktop/dexterslab/scripts/observer-kiosk.sh
```

## Step 4: Install the Autostart Entry

```bash
mkdir -p ~/.config/autostart
cp /home/thecabbage/Desktop/dexterslab/scripts/observer-kiosk.desktop ~/.config/autostart/
```

## Step 5: Configure Auto-Login

Make sure the Pi auto-logs in to the desktop on boot:

```bash
sudo raspi-config
```

Navigate to: **System Options → Boot / Auto Login → Desktop Autologin**

## Step 6: Reboot and Test

```bash
sudo reboot
```

After reboot, the Pi should:
1. Auto-login to the desktop
2. Start the Node.js backend + frontend via systemd
3. Launch Chromium in kiosk mode once the server is ready
4. Display the Observer Hub fullscreen on the circular display

## Troubleshooting

**Server not starting?**
```bash
sudo systemctl status dexterslab.service
journalctl -u dexterslab.service -n 50
```

**Chromium not launching?**
```bash
# Run the kiosk script manually to see errors:
/home/thecabbage/Desktop/dexterslab/scripts/observer-kiosk.sh
```

**Want to exit kiosk mode?**
Press `Alt+F4` or SSH in and run:
```bash
pkill chromium
```
