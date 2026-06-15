#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot entrypoint for the Haushalts-Dashboard tablet.
# Install: copy to ~/.termux/boot/tablet-boot.sh and `chmod +x` it. Termux:Boot
# runs everything in ~/.termux/boot/ on device boot.
#
# Order: wake-lock -> tailscaled -> dashboard server -> tailscale serve (HTTPS).
set -e

# Keep CPU/network awake while the server runs (prevents Doze killing it).
termux-wake-lock 2>/dev/null || true

# Tailscale daemon, userspace mode (no root). Idempotent-ish: pgrep guard.
if ! pgrep -f "tailscaled" >/dev/null 2>&1; then
  tailscaled --tun=userspace-networking --socks5-server=localhost:1055 \
    >"$HOME/tailscaled.log" 2>&1 &
  sleep 2
fi
# Bring the tailnet up (no-op if already authorized).
tailscale up >/dev/null 2>&1 || true

# Start the dashboard (build must already exist; see tablet-start.sh).
cd "$HOME/haushalts-dashboard"
bash scripts/tablet-start.sh >"$HOME/dashboard.log" 2>&1 &

# Wait for the server to answer, then (re)expose it over HTTPS.
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/ >/dev/null 2>&1; then break; fi
  sleep 1
done
tailscale serve --bg https / http://127.0.0.1:3001 || true
