# Tablet Kiosk Autostart

Goal: on boot the tablet starts the dashboard server + Cloudflare tunnel
automatically, and Fully Kiosk Browser opens the dashboard fullscreen with the
screen kept on.

Prerequisite: Cloudflare tunnel set up per [tablet-remote-access.md](./tablet-remote-access.md),
and a production build exists (`cd web && npx next build --webpack`).

## 1. Server autostart (Termux:Boot)

1. Install the **Termux:Boot** app (F-Droid) and open it once so Android grants
   it boot permission.
2. Copy the boot script into place:
   ```bash
   mkdir -p ~/.termux/boot
   cp ~/haushalts-dashboard/scripts/tablet-boot.sh ~/.termux/boot/tablet-boot.sh
   chmod +x ~/.termux/boot/tablet-boot.sh
   ```
3. Disable battery optimization for Termux and Termux:Boot (Android Settings →
   Apps → … → Battery → Unrestricted) so Android does not kill them.

On the next reboot the script runs: wake-lock → dashboard → wait for `:3001` →
`cloudflared tunnel run cockpit`. Logs land in `~/dashboard.log` and
`~/cloudflared.log`.

## 2. Display autostart (Fully Kiosk Browser)

1. Install **Fully Kiosk Browser** (free tier is enough).
2. Settings:
   - **Start URL:** `https://cockpit.domelehmann.org` (the Cloudflare HTTPS URL
     from the remote-access doc). First load passes the Cloudflare Access login
     once; Fully keeps the session cookie afterwards.
   - **Web Content → Autoplay / fullscreen:** enable **Fullscreen**.
   - **Device Management → Keep Screen On:** ON.
   - **Device Management → Screen Off Timer:** 0 (never).
   - **Web Auto Reload → Auto Reload after Page Error:** enable, ~30s (this is
     the "on connection error" reload; Android 6+ also retries HTTP 40x/50x).
     Optionally **Auto Reload on Idle** too. This is its *own* section, not under
     Advanced Web.
   - **Device Management → Launch on Boot:** ON. (Not "Universal Launcher" — that
     is the app-grid home screen, a different feature.)
3. Disable battery optimization for Fully Kiosk as well.

## Boot order race

Fully Kiosk may launch before the server is ready. The boot script waits up to
30s for `127.0.0.1:3001`, and Fully's **Auto-Reload on connection error**
retries the URL until the server answers — so the dashboard appears once both
are up. No manual intervention needed.

## Verify

1. Reboot the tablet.
2. Within ~1 minute the dashboard should appear fullscreen (no browser toolbar),
   screen staying on.
3. From the phone (anywhere), open `https://cockpit.domelehmann.org`, pass the
   Access login once, confirm it loads; install via **Add to Home Screen**.

## Troubleshooting

- Blank/"no connection" screen that never recovers → check `~/dashboard.log`
  and that the build exists; confirm `curl http://127.0.0.1:3001/` on the tablet.
- Screen turns off → re-check Keep Screen On + Screen Off Timer = 0 and battery
  optimization is disabled for Fully Kiosk.
- Server not up after reboot → confirm Termux:Boot has boot permission and
  battery optimization is off for Termux + Termux:Boot.
