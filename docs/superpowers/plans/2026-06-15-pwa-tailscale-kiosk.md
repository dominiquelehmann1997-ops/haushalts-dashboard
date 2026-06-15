# PWA + Tailscale Remote Access + Tablet Kiosk Autostart — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Haushalts-Dashboard installable as a standalone PWA, reachable from anywhere over Tailscale HTTPS, and auto-starting in fullscreen kiosk mode on the tablet at boot.

**Architecture:** Three independent layers. (1) PWA code in the Next.js app: PNG icons, PNG-based manifest, minimal offline service worker, SW registration, security headers. (2) Tailscale `serve` on the tablet provides an HTTPS cert on the MagicDNS name → secure context for the PWA, proxying to local Next.js on `127.0.0.1:3001`. (3) Termux:Boot + Fully Kiosk Browser auto-start the server and display. SQLite stays local on the tablet — no DB migration.

**Tech Stack:** Next.js 16.2.7 (App Router), React 19, vitest 4, sharp (icon generation, already present via Next), Tailscale (userspace-networking in Termux), Fully Kiosk Browser.

**Reference:** Next 16 PWA guide at `web/node_modules/next/dist/docs/01-app/02-guides/progressive-web-apps.md`. **Out of scope (YAGNI):** push notifications, DB migration, native app.

---

## File Structure

| File | Responsibility | Action |
|------|----------------|--------|
| `web/scripts/gen-icons.mjs` | Render teal house SVG → PNG icons (run-once) | Create |
| `web/public/icon-192.png` `icon-512.png` `icon-512-maskable.png` `apple-icon-180.png` | App icons, committed | Create (generated) |
| `web/public/manifest.webmanifest` | PWA manifest, PNG icon entries | Modify |
| `web/src/app/manifest.test.ts` | Manifest assertions | Modify |
| `web/public/offline.html` | Offline fallback page (cached by SW) | Create |
| `web/public/sw.js` | Minimal service worker: install/activate/fetch | Create |
| `web/src/app/sw.test.ts` | Service worker file assertions | Create |
| `web/src/app/sw-register.tsx` | Client component, registers `/sw.js` | Create |
| `web/src/app/layout.tsx` | Mount SW register, PNG icon metadata | Modify |
| `web/next.config.ts` | `headers()`: sw.js no-cache + security headers | Modify |
| `web/package.json` | `gen:icons` script, `sharp` devDep | Modify |
| `docs/tablet-remote-access.md` | Tailscale setup runbook | Create |
| `docs/tablet-kiosk-setup.md` | Kiosk + boot runbook | Create |
| `scripts/tablet-boot.sh` | Termux:Boot template (server + tailscale) | Create |

---

## Task 1: PNG icons from SVG

**Files:**
- Create: `web/scripts/gen-icons.mjs`
- Modify: `web/package.json`
- Create (generated, committed): `web/public/icon-192.png`, `web/public/icon-512.png`, `web/public/icon-512-maskable.png`, `web/public/apple-icon-180.png`

- [ ] **Step 1: Write the icon generator script**

Create `web/scripts/gen-icons.mjs`:

```js
// Renders the teal house icon (public/icon.svg) into the PNG sizes that
// iOS/Android home-screen install needs. Flatten onto solid teal so there are
// no transparent corners (iOS apple-touch and maskable both want full-bleed).
// Run-once: `npm run gen:icons`. The PNGs are committed.
import sharp from "sharp";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const pub = join(here, "..", "public");
const src = join(pub, "icon.svg");
const TEAL = "#0f766e";

const targets = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "icon-512-maskable.png", size: 512 },
  { name: "apple-icon-180.png", size: 180 },
];

for (const { name, size } of targets) {
  await sharp(src)
    .resize(size, size)
    .flatten({ background: TEAL })
    .png()
    .toFile(join(pub, name));
  console.log("wrote", name);
}
```

- [ ] **Step 2: Add the script and sharp devDependency to package.json**

In `web/package.json`, add to `"scripts"`:

```json
    "gen:icons": "node scripts/gen-icons.mjs",
```

And add to `"devDependencies"` (sharp is already present transitively via Next; declare it explicitly so the script is stable):

```json
    "sharp": "^0.34.0",
```

Run: `cd web && npm install`
Expected: completes; `node_modules/sharp` present.

- [ ] **Step 3: Generate the PNGs**

Run: `cd web && npm run gen:icons`
Expected output:
```
wrote icon-192.png
wrote icon-512.png
wrote icon-512-maskable.png
wrote apple-icon-180.png
```

- [ ] **Step 4: Verify the files exist and are valid PNGs**

Run: `cd web && node -e "const s=require('sharp'); ['icon-192','icon-512','icon-512-maskable','apple-icon-180'].forEach(async n=>console.log(n, (await s('public/'+n+'.png').metadata()).width))"`
Expected: prints widths `192 512 512 180` (order may vary).

- [ ] **Step 5: Commit**

```bash
git add web/scripts/gen-icons.mjs web/package.json web/package-lock.json web/public/icon-192.png web/public/icon-512.png web/public/icon-512-maskable.png web/public/apple-icon-180.png
git commit -m "feat(pwa): generate PNG app icons from SVG"
```

---

## Task 2: Manifest uses PNG icons

**Files:**
- Modify: `web/public/manifest.webmanifest`
- Test: `web/src/app/manifest.test.ts`

- [ ] **Step 1: Extend the failing test**

In `web/src/app/manifest.test.ts`, replace the `"declares 192 and 512 icon sizes"` and `"declares a maskable icon"` tests (and add a PNG-type + apple-icon test). The full updated file:

```ts
import { existsSync } from "node:fs";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("PWA manifest", () => {
  const manifest = JSON.parse(
    readFileSync(join(process.cwd(), "public", "manifest.webmanifest"), "utf-8"),
  );
  const icons = manifest.icons as Array<{
    src: string;
    sizes: string;
    type: string;
    purpose?: string;
  }>;

  it("is installable as a standalone app", () => {
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    expect(typeof manifest.name).toBe("string");
    expect(manifest.name.length).toBeGreaterThan(0);
  });

  it("declares 192 and 512 PNG icons", () => {
    const png192 = icons.find(
      (i) => i.sizes === "192x192" && i.type === "image/png",
    );
    const png512 = icons.find(
      (i) => i.sizes === "512x512" && i.type === "image/png",
    );
    expect(png192).toBeDefined();
    expect(png512).toBeDefined();
  });

  it("declares a maskable PNG icon", () => {
    const maskable = icons.find(
      (i) => (i.purpose ?? "").includes("maskable") && i.type === "image/png",
    );
    expect(maskable).toBeDefined();
  });

  it("ships the referenced icon files", () => {
    for (const icon of icons) {
      expect(
        existsSync(join(process.cwd(), "public", icon.src.replace(/^\//, ""))),
        `missing icon file: ${icon.src}`,
      ).toBe(true);
    }
    expect(
      existsSync(join(process.cwd(), "public", "apple-icon-180.png")),
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/app/manifest.test.ts`
Expected: FAIL — current manifest icons are `image/svg+xml`, no `image/png` entries.

- [ ] **Step 3: Update the manifest**

Replace `web/public/manifest.webmanifest` with:

```json
{
  "name": "Haushalts-Cockpit",
  "short_name": "Cockpit",
  "description": "Familien-Dashboard — Aufgaben, Termine, Essensplan und Einkauf.",
  "start_url": "/",
  "display": "standalone",
  "orientation": "landscape",
  "background_color": "#0b0f14",
  "theme_color": "#0f766e",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png", "purpose": "any" },
    { "src": "/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" },
    { "src": "/icon.svg", "sizes": "any", "type": "image/svg+xml", "purpose": "any" }
  ]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd web && npx vitest run src/app/manifest.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add web/public/manifest.webmanifest web/src/app/manifest.test.ts
git commit -m "feat(pwa): point manifest at PNG icons"
```

---

## Task 3: Service worker + offline fallback

**Files:**
- Create: `web/public/offline.html`
- Create: `web/public/sw.js`
- Test: `web/src/app/sw.test.ts`

- [ ] **Step 1: Write the failing test**

Create `web/src/app/sw.test.ts`:

```ts
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

describe("service worker", () => {
  const sw = readFileSync(join(process.cwd(), "public", "sw.js"), "utf-8");

  it("registers install, activate and fetch handlers", () => {
    expect(sw).toContain('addEventListener("install"');
    expect(sw).toContain('addEventListener("activate"');
    expect(sw).toContain('addEventListener("fetch"');
  });

  it("precaches an offline fallback that exists", () => {
    expect(sw).toContain("/offline.html");
    expect(existsSync(join(process.cwd(), "public", "offline.html"))).toBe(true);
  });

  it("does not implement push notifications (out of scope)", () => {
    expect(sw).not.toContain('addEventListener("push"');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd web && npx vitest run src/app/sw.test.ts`
Expected: FAIL — `public/sw.js` does not exist (readFileSync throws).

- [ ] **Step 3: Create the offline fallback page**

Create `web/public/offline.html`:

```html
<!doctype html>
<html lang="de">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Cockpit — offline</title>
    <style>
      html, body {
        height: 100%;
        margin: 0;
        background: #0b0f14;
        color: #e6edf3;
        font-family: system-ui, sans-serif;
        display: grid;
        place-items: center;
      }
      .box { text-align: center; padding: 2rem; }
      h1 { color: #0f766e; margin: 0 0 0.5rem; }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>Keine Verbindung</h1>
      <p>Das Dashboard ist gerade nicht erreichbar. Sobald wieder Netz da ist, lädt es automatisch.</p>
    </div>
  </body>
</html>
```

- [ ] **Step 4: Create the service worker**

Create `web/public/sw.js`:

```js
// Minimal service worker for the Haushalts-Cockpit PWA.
// Purpose: installability + an offline fallback for navigations. It does NOT
// cache task data — the dashboard is force-dynamic and must always be fresh,
// so only the static offline shell is cached. No push notifications.
const CACHE = "cockpit-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.add(OFFLINE_URL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  // Only intervene on page navigations: try the network, fall back to the
  // cached offline page when the tablet/phone has no connection.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
  }
});
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd web && npx vitest run src/app/sw.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add web/public/sw.js web/public/offline.html web/src/app/sw.test.ts
git commit -m "feat(pwa): minimal offline service worker"
```

---

## Task 4: Register the service worker + PNG icon metadata

**Files:**
- Create: `web/src/app/sw-register.tsx`
- Modify: `web/src/app/layout.tsx`

- [ ] **Step 1: Create the SW registration client component**

Create `web/src/app/sw-register.tsx`:

```tsx
"use client";

import { useEffect } from "react";

// Registers the service worker on the client. Guards on secure context:
// over plain http (e.g. the raw Tailscale IP) `serviceWorker` registration is
// unavailable, so we skip silently. Over the Tailscale HTTPS MagicDNS name and
// on localhost this runs normally.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !window.isSecureContext
    ) {
      return;
    }
    navigator.serviceWorker
      .register("/sw.js", { scope: "/", updateViaCache: "none" })
      .catch(() => {
        // Registration failures are non-fatal — the app still works online.
      });
  }, []);

  return null;
}
```

- [ ] **Step 2: Mount it and update icon metadata in layout**

In `web/src/app/layout.tsx`:

(a) Add the import after the existing imports (below the `globals.css` import):

```tsx
import { ServiceWorkerRegister } from "./sw-register";
```

(b) Replace the `icons` line in `metadata` (currently `icons: { icon: "/icon.svg", apple: "/icon.svg" },`) with:

```tsx
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    apple: "/apple-icon-180.png",
  },
```

(c) Mount the component inside `<body>`, before `{children}`:

```tsx
      <body className="font-body text-ink antialiased">
        <ServiceWorkerRegister />
        {children}
      </body>
```

- [ ] **Step 3: Typecheck**

Run: `cd web && npm run typecheck`
Expected: no errors.

- [ ] **Step 4: Lint**

Run: `cd web && npm run lint`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add web/src/app/sw-register.tsx web/src/app/layout.tsx
git commit -m "feat(pwa): register service worker and add PNG apple-touch icon"
```

---

## Task 5: Security + service-worker headers

**Files:**
- Modify: `web/next.config.ts`

- [ ] **Step 1: Add headers() to the config**

Replace `web/next.config.ts` with:

```ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          {
            key: "Content-Type",
            value: "application/javascript; charset=utf-8",
          },
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
```

- [ ] **Step 2: Verify the build picks up the config**

Run: `cd web && npm run build`
Expected: build succeeds (no config errors). (This is the slow full build — acceptable as a config smoke test.)

- [ ] **Step 3: Verify headers are served**

Run (in one shell): `cd web && npm run start &` — wait ~3s for "Ready".
Then: `curl -sI http://localhost:3001/sw.js | grep -i "cache-control\|content-type"`
Expected: `Cache-Control: no-cache, no-store, must-revalidate` and `Content-Type: application/javascript; charset=utf-8`.
Then: `curl -sI http://localhost:3001/ | grep -i "x-frame-options"`
Expected: `X-Frame-Options: DENY`.
Stop the server: `kill %1`.

- [ ] **Step 4: Commit**

```bash
git add web/next.config.ts
git commit -m "feat(pwa): security headers and no-cache for service worker"
```

---

## Task 6: Tailscale remote-access runbook

**Files:**
- Create: `docs/tablet-remote-access.md`

- [ ] **Step 1: Write the runbook**

Create `docs/tablet-remote-access.md`:

````markdown
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
````

- [ ] **Step 2: Commit**

```bash
git add docs/tablet-remote-access.md
git commit -m "docs: Tailscale remote-access runbook for the tablet"
```

---

## Task 7: Kiosk autostart runbook + boot script

**Files:**
- Create: `scripts/tablet-boot.sh`
- Create: `docs/tablet-kiosk-setup.md`

- [ ] **Step 1: Write the boot script template**

Create `scripts/tablet-boot.sh`:

```bash
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
```

- [ ] **Step 2: Write the kiosk runbook**

Create `docs/tablet-kiosk-setup.md`:

````markdown
# Tablet Kiosk Autostart

Goal: on boot the tablet starts the dashboard server + Tailscale automatically,
and Fully Kiosk Browser opens the dashboard fullscreen with the screen kept on.

Prerequisite: Tailscale set up per [tablet-remote-access.md](./tablet-remote-access.md),
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

On the next reboot the script runs: wake-lock → tailscaled → dashboard →
`tailscale serve`. Logs land in `~/dashboard.log` and `~/tailscaled.log`.

## 2. Display autostart (Fully Kiosk Browser)

1. Install **Fully Kiosk Browser** (free tier is enough).
2. Settings:
   - **Start URL:** `https://<tablet>.<tailnet>.ts.net` (the MagicDNS HTTPS URL
     from the remote-access doc).
   - **Web Content → Autoplay / fullscreen:** enable **Fullscreen**.
   - **Device Management → Keep Screen On:** ON.
   - **Device Management → Screen Off Timer:** 0 (never).
   - **Advanced Web → Auto-Reload on Idle / on connection error:** enable, ~30s.
   - **Universal Launcher / Start Automatically (on boot):** ON.
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
3. From the phone (anywhere on the tailnet), open the MagicDNS HTTPS URL and
   confirm it loads; install via **Add to Home Screen**.

## Troubleshooting

- Blank/"no connection" screen that never recovers → check `~/dashboard.log`
  and that the build exists; confirm `curl http://127.0.0.1:3001/` on the tablet.
- Screen turns off → re-check Keep Screen On + Screen Off Timer = 0 and battery
  optimization is disabled for Fully Kiosk.
- Server not up after reboot → confirm Termux:Boot has boot permission and
  battery optimization is off for Termux + Termux:Boot.
````

- [ ] **Step 3: Make the boot script executable and commit**

```bash
git update-index --chmod=+x scripts/tablet-boot.sh 2>/dev/null || true
git add scripts/tablet-boot.sh docs/tablet-kiosk-setup.md
git commit -m "docs: tablet kiosk autostart runbook and boot script"
```

---

## Task 8: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full test suite**

Run: `cd web && npx vitest run`
Expected: all tests pass, including `manifest.test.ts` (4) and `sw.test.ts` (3).

- [ ] **Step 2: Typecheck**

Run: `cd web && npm run typecheck`
Expected: no errors.

- [ ] **Step 3: Lint**

Run: `cd web && npm run lint`
Expected: no errors.

- [ ] **Step 4: Build**

Run: `cd web && npm run build`
Expected: build succeeds.

- [ ] **Step 5: Tablet build + manual verification**

On the tablet (per AGENTS workflow):
```bash
cd ~/haushalts-dashboard && git pull --ff-only && cd web \
  && npx next build --webpack && bash ~/restart-dashboard.sh
```
Then, following `docs/tablet-remote-access.md` and `docs/tablet-kiosk-setup.md`:
- Set up Tailscale + `tailscale serve`.
- Open the MagicDNS HTTPS URL on the phone → install PWA → confirm standalone
  (no toolbar).
- Reboot the tablet → confirm the dashboard auto-starts fullscreen.

- [ ] **Step 6: Merge to main and push**

```bash
git checkout main && git merge --no-ff <feature-branch> && git push
```

---

## Self-Review Notes

- **Spec coverage:** Part 1 PWA → Tasks 1–5. Part 2 Tailscale → Task 6. Part 3
  Kiosk → Task 7. Testing/verification → Tasks 2, 3, 8. All spec deliverables
  mapped.
- **Push notifications excluded** per spec (asserted absent in `sw.test.ts`).
- **No DB migration / base-URL change** — documented in Task 6, none in code.
- **Type/name consistency:** `ServiceWorkerRegister` component name consistent
  between Task 4 creation and layout mount; icon filenames consistent across
  Tasks 1, 2, 4.
