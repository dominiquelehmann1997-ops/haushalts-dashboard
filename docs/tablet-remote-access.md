# Tablet Remote Access via Tailscale

Goal: reach the dashboard from the phone anywhere, over HTTPS, without exposing
it publicly. The tablet runs Tailscale in Termux (no root, userspace networking)
and `tailscale serve` provides a real HTTPS cert on the MagicDNS name, proxying
to the local Next.js server on `127.0.0.1:3001`. SQLite stays local — no DB
migration.

## One-time account setup (from zero)

1. On the phone, install the **Tailscale** app from the store.
2. Open it, **Sign up**, choose **Continue with Google** (your Gmail). This
   creates the tailnet and authorizes the phone.
3. In the [admin console](https://login.tailscale.com/admin):
   - **DNS → MagicDNS:** Enable.
   - **DNS → HTTPS Certificates:** Enable.
   Note the tailnet name shown, e.g. `tail1234.ts.net`.

## Tablet setup (Termux, no root)

SSH in: `ssh -p 8022 u0_a353@192.168.178.91`

```bash
pkg update && pkg install tailscale

# Start the daemon in userspace mode (no root). Keep it running in the
# background; on real use this is launched from the boot script (see kiosk doc).
tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &

# Authorize this device — prints a login URL. Open it, sign in with the SAME
# Google account, approve the tablet.
tailscale up

# Confirm the tablet's MagicDNS name (e.g. tablet.tail1234.ts.net):
tailscale status
```

## Expose the dashboard over HTTPS

With the Next.js prod server already running on `127.0.0.1:3001`:

```bash
tailscale serve --bg https / http://127.0.0.1:3001
tailscale serve status   # shows the https://<tablet>.<tailnet>.ts.net URL
```

The dashboard is now reachable from any device in the tailnet at
`https://<tablet>.<tailnet>.ts.net`.

## Why HTTPS matters here

The PWA service worker only registers in a **secure context**. `http://100.x.x.x`
(the raw Tailscale IP) is not a secure context, so SW + reliable install would
break. The MagicDNS HTTPS URL is a proper secure context → install + standalone
work from the phone anywhere.

## Notes

- No Next.js change needed: production `next start` does not restrict the `Host`
  header (that is a dev-server concern), and `serve` maps root `/`, so the
  manifest `start_url: "/"` stays valid.
- Nothing is exposed publicly — only devices in your tailnet can reach it.
- The phone install: open the MagicDNS HTTPS URL in the phone browser → browser
  menu → **Add to Home Screen / Install app**.

## Troubleshooting

- `tailscale serve` complains HTTPS is not available → re-check **HTTPS
  Certificates** is enabled in the admin console and MagicDNS is on.
- Cert provisioning can take a few seconds on first request; retry the URL.
- If userspace `serve` misbehaves, fall back to plain reachability via the
  MagicDNS name on port 3001 (`http://<tablet>.<tailnet>.ts.net:3001`) for
  quick checks — but the PWA install needs the HTTPS `serve` path.
