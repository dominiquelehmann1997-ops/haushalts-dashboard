#!/data/data/com.termux/files/usr/bin/bash
# Termux:Boot entrypoint for the Haushalts-Dashboard tablet.
# Install: copy to ~/.termux/boot/tablet-boot.sh and `chmod +x` it. Termux:Boot
# runs everything in ~/.termux/boot/ on device boot.
#
# Order: wake-lock -> sshd -> dashboard server -> wait for :3001 -> cloudflared.
#
# Every step is idempotent (pgrep guard), so this doubles as a repair hook: a
# Termux app update force-stops the app and kills the whole process tree without
# rebooting the device, and Termux:Boot only fires on boot. Re-running this
# script by hand brings back whatever died and leaves the rest alone:
#
#   bash ~/.termux/boot/tablet-boot.sh
#
# ponytail: manual re-run, no watchdog. A watchdog inside Termux gets killed by
# the very force-stop it would recover from, so it buys nothing. The only thing
# that could restart Termux from outside is Android's JobScheduler
# (termux-job-scheduler --period-ms 900000 --persisted true --script ...), which
# needs the Termux:API *app* installed — it is not, and without it the CLI hangs
# forever instead of erroring. Install that app if the manual re-run gets old.
#
# Remote access is a Cloudflare named tunnel ("cockpit"), not Tailscale —
# Android 16 blocks netlink for non-root, so tailscaled cannot start. cloudflared
# runs entirely in userspace. See docs/tablet-remote-access.md.

# Keep CPU/network awake while the server runs (prevents Doze killing it).
termux-wake-lock 2>/dev/null || true

# SSH first — if a later step fails, remote access still works to debug it.
# (The [s] bracket keeps pgrep from matching its own command line.)
if ! pgrep -f "[s]shd" >/dev/null 2>&1; then
  sshd
fi

# Start the dashboard (build must already exist; see tablet-start.sh).
cd "$HOME/haushalts-dashboard"
if ! pgrep -f "[n]ext-server" >/dev/null 2>&1; then
  bash scripts/tablet-start.sh >"$HOME/dashboard.log" 2>&1 &
fi

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
