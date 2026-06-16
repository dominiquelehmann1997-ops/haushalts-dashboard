# Tablet Remote Access via Cloudflare Tunnel

Goal: reach the dashboard from the phone anywhere, over HTTPS, without exposing
it publicly. The tablet runs a Cloudflare **named tunnel** (`cloudflared`, no
root, fully userspace) that connects out to Cloudflare's edge and proxies the
hostname `cockpit.domelehmann.org` to the local Next.js server on
`localhost:3001`. **Cloudflare Access** gates the hostname so only one Google
identity can reach it. SQLite stays local — no DB migration.

> Why not Tailscale? The tablet is **Android 16** with no root. `tailscaled`
> crashes on start with `netmon.New: route ip+net: netlinkrib: permission
> denied` — Android 13+ blocks netlink for non-root apps. cloudflared needs no
> netlink, so it works where Tailscale cannot.

## One-time account setup (from zero)

1. A domain on a **Cloudflare** account (here: `domelehmann.org`), nameservers
   pointed at Cloudflare so it manages DNS.
2. Cloudflare **Zero Trust** enabled on the account (free plan is enough) for
   Access — set up in step *Lock it down* below.

## Tablet setup (Termux, no root)

SSH in: `ssh -p 8022 u0_a353@192.168.178.91`

```bash
pkg update && pkg install cloudflared

# 1. Authorize this machine against your Cloudflare account. Prints a URL —
#    open it, pick the domain (domelehmann.org), Authorize. Writes
#    ~/.cloudflared/cert.pem.
cloudflared tunnel login

# 2. Create the named tunnel. Writes ~/.cloudflared/<UUID>.json (the tunnel
#    credentials — keep secret).
cloudflared tunnel create cockpit

# 3. Route the hostname to this tunnel (creates a proxied CNAME in DNS).
cloudflared tunnel route dns cockpit cockpit.domelehmann.org
```

Then write `~/.cloudflared/config.yml` (use the UUID printed by `create`):

```yaml
tunnel: <UUID>
credentials-file: /data/data/com.termux/files/home/.cloudflared/<UUID>.json
ingress:
  - hostname: cockpit.domelehmann.org
    service: http://localhost:3001
  - service: http_status:404
```

Validate: `cloudflared tunnel ingress validate` → `OK`.

## Run the tunnel

With the Next.js prod server already running on `localhost:3001`:

```bash
cloudflared --no-autoupdate --logfile ~/cloudflared.log tunnel run cockpit
```

The log should show four `Registered tunnel connection` lines (two Frankfurt,
two Düsseldorf edge colos). The dashboard is then reachable at
`https://cockpit.domelehmann.org`.

On the tablet this is launched in the background and survives SSH disconnect /
Doze the same way the dashboard server is — see the boot script
([scripts/tablet-boot.sh](../scripts/tablet-boot.sh)) and
[tablet-kiosk-setup.md](./tablet-kiosk-setup.md). The persistence trick:

```bash
# Launch + verify in ONE ssh session (a detached process can die if the flaky
# ssh channel closes mid-spawn). wake-lock + setsid + </dev/null survives.
setsid bash ~/run-tunnel.sh >/dev/null 2>&1 </dev/null &
sleep 12 && tail -n 20 ~/cloudflared.log   # expect: Registered tunnel connection
```

## Lock it down — Cloudflare Access (mandatory)

Until Access is configured the hostname is **public**. Set it up immediately:

1. Open [Zero Trust](https://one.dash.cloudflare.com) → your account (pick a
   team name + free plan on first use).
2. **Access → Applications → Add an application → Self-hosted.**
3. Name `Cockpit`; Session Duration e.g. `1 month`; Public hostname
   `cockpit` + `domelehmann.org`.
4. Policy: name `Only me`, action **Allow**, Include → **Emails** →
   `dominique.lehmann1997@gmail.com`.
5. Add the application.
6. **Login method:** Google (Settings → Authentication → Login methods → add
   Google), or **One-time PIN** (no setup — emails a code) as a simpler default.

Verify the gate: `curl -I https://cockpit.domelehmann.org/` from outside should
**302/redirect to `*.cloudflareaccess.com`**, not serve the dashboard.

## Why HTTPS matters here

The PWA service worker only registers in a **secure context**.
`https://cockpit.domelehmann.org` is a proper secure context → SW + install +
standalone work from the phone anywhere. (The tablet itself can also install via
`http://localhost:3001`, since localhost is a secure context.)

## Notes

- No Next.js change needed: production `next start` does not restrict the `Host`
  header (that is a dev-server concern), and ingress maps `/`, so the manifest
  `start_url: "/"` stays valid.
- Nothing is exposed publicly once Access is on — only your authenticated
  identity reaches it; the origin is never directly addressable.
- The phone install: open `https://cockpit.domelehmann.org`, pass the Access
  login once, then browser menu → **Add to Home Screen / Install app**.

## Troubleshooting

- External request returns **530** (Cloudflare 1033) → the tunnel is not
  connected. Check `~/cloudflared.log` for `Registered tunnel connection`; the
  detached process may have died on a flaky ssh exit — relaunch + verify in one
  session (see above).
- `tunnel login` prints `Failed to fetch resource` → no domain selected /
  authorized on the account; redo the login and pick `domelehmann.org`.
- Login URL but no `cert.pem` written → authorize step not completed in the
  browser; the `cloudflared tunnel login` process waits until you do.
