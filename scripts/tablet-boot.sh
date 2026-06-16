#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot entrypoint for the Haushalts-Dashboard tablet.
# Install: copy to ~/.termux/boot/tablet-boot.sh and `chmod +x` it. Termux:Boot
# runs everything in ~/.termux/boot/ on device boot.
#
# Order: wake-lock -> dashboard server -> wait for :3001 -> cloudflared tunnel.
#
# Remote access is a Cloudflare named tunnel ("cockpit"), not Tailscale —
# Android 16 blocks netlink for non-root, so tailscaled cannot start. cloudflared
# runs entirely in userspace. See docs/tablet-remote-access.md.

# Keep CPU/network awake while the server runs (prevents Doze killing it).
termux-wake-lock 2>/dev/null || true

# Start the dashboard (build must already exist; see tablet-start.sh).
cd "$HOME/haushalts-dashboard"
bash scripts/tablet-start.sh >"$HOME/dashboard.log" 2>&1 &

# Wait for the local server to answer before bringing the tunnel up.
for i in $(seq 1 30); do
  if curl -sf http://127.0.0.1:3001/ >/dev/null 2>&1; then break; fi
  sleep 1
done

# Cloudflare tunnel (named "cockpit"), config in ~/.cloudflared/config.yml.
# Idempotent: skip if already running. --no-autoupdate so it never blocks on a
# self-update at boot.
if ! pgrep -f "cloudflared.*tunnel run" >/dev/null 2>&1; then
  cloudflared --no-autoupdate --logfile "$HOME/cloudflared.log" \
    tunnel run cockpit &
fi
