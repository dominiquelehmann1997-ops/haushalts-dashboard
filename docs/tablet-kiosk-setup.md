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
   - **Start URL:** `http://localhost:3001` — the local server, *not* the
     Cloudflare URL. The tablet is the machine running the server, so routing its
     own display through Cloudflare's edge only adds a dependency: when
     `cloudflared` dies, the kiosk shows a Cloudflare **Error 1033** page even
     though the dashboard is up and answering on `:3001`. Local also skips the
     Access login entirely.

     PWA/service worker still work: `http://localhost` is a
     [secure context](https://developer.mozilla.org/docs/Web/Security/Secure_Contexts)
     by spec, same as HTTPS. The tunnel stays as-is for phone access from outside.

     > Origin change: `localhost:3001` and `cockpit.domelehmann.org` are separate
     > origins, so the kiosk starts with a fresh service-worker cache and no
     > stored logins. Google-Kalender OAuth was already authorized against
     > `localhost:3001` (see [deploy notes](./push-setup.md)), so nothing to redo.
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

## If the kiosk shows an error page

Match the page to the layer that broke:

| Kiosk shows | Meaning | Fix |
| --- | --- | --- |
| Connection refused / no connection | Next.js server down | `bash ~/.termux/boot/tablet-boot.sh` (idempotent, restores what died) |
| Cloudflare **Error 1033** | Tunnel has no backend — only possible if Start URL still points at the Cloudflare hostname | Switch Start URL to `http://localhost:3001` (above), then same command |

A Termux **app update** force-stops Termux and kills the whole process tree
(server, tunnel, `sshd`) *without* rebooting, and `~/.termux/boot/` only fires on
boot — so nothing comes back by itself. Check `uptime` first: a long uptime means
this happened rather than a failed boot autostart.

## Verify

Two independent paths — the tablet display goes straight to `:3001`, only the
phone goes through the tunnel:

1. Reboot the tablet.
2. Within ~1 minute the dashboard should appear fullscreen (no browser toolbar),
   screen staying on. This must work even with `cloudflared` stopped — if it
   does not, the Start URL is still the Cloudflare hostname.
3. From the phone (anywhere), open `https://cockpit.domelehmann.org`, pass the
   Access login once, confirm it loads; install via **Add to Home Screen**.

## Troubleshooting

- Blank/"no connection" screen that never recovers → check `~/dashboard.log`
  and that the build exists; confirm `curl http://127.0.0.1:3001/` on the tablet.
- Screen turns off → re-check Keep Screen On + Screen Off Timer = 0 and battery
  optimization is disabled for Fully Kiosk.
- Server not up after reboot → confirm Termux:Boot has boot permission and
  battery optimization is off for Termux + Termux:Boot.
