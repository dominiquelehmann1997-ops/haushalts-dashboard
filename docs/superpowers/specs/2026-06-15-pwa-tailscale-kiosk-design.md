# Haushalts-Dashboard: PWA + Tailscale-Fernzugriff + Tablet-Kiosk-Autostart

**Datum:** 2026-06-15
**Status:** Approved (brainstorming) — bereit für writing-plans

## Ziel

Das fertige Kompakt-Dashboard (läuft am Tablet, Termux, Port 3001) in Betrieb
nehmen als:

1. **PWA** — auf Handy UND Tablet installierbar ("Zum Startbildschirm"),
   Vollbild/standalone (Browser-Toolbar weg).
2. **Fernzugriff via Tailscale** — Handy erreicht das Tablet von überall über
   die Tailnet-Adresse, ohne öffentliche Exposition. SQLite bleibt lokal am
   Tablet, keine DB-Migration.
3. **Tablet-Kiosk-Autostart** — Server startet bei Boot, Dashboard öffnet sich
   automatisch im Vollbild, Display bleibt an.

## Entscheidungen (aus Brainstorming)

| Frage | Entscheidung |
|-------|--------------|
| HTTPS für PWA-Install über Tailscale | `tailscale serve` HTTPS-Proxy → echtes Cert auf MagicDNS-Name (secure context) |
| Tailscale-Auth | Noch kein Account → Doku startet bei Null, Login via Google |
| Kiosk-Browser | Fully Kiosk Browser (Gratis-Tier) |
| Icon-Quelle | PNGs aus vorhandenem Haus-SVG generieren (teal `#0f766e`) |

**Bewusst ausgeschlossen (YAGNI):** Push-Notifications, DB-Migration, Native-App.

## Architektur

```
Handy/Tablet-Browser ──HTTPS──> tailscale serve (am Tablet)
                                      │ proxyt auf
                                      ▼
                              Next.js prod :3001 (127.0.0.1)
                                      │
                                  SQLite (lokal, unverändert)
```

`tailscale serve` liefert ein echtes Let's-Encrypt-Cert auf dem MagicDNS-Namen
→ secure context → Service-Worker + PWA-Install funktionieren von überall im
Tailnet. Keine öffentliche Exposition (nur tailnet-intern erreichbar).

**Ausgangslage (bereits vorhanden):**
- `web/public/manifest.webmanifest` — `display: standalone`, `orientation: landscape`,
  `theme_color: #0f766e`, Icons (aktuell nur SVG)
- `web/src/app/layout.tsx` — `metadata.manifest`, `appleWebApp`, `viewport.themeColor`
- `web/src/app/manifest.test.ts` — Vitest für Manifest
- Next.js **16.2.7** (Breaking Changes — Doku in `web/node_modules/next/dist/docs/`,
  v.a. `01-app/02-guides/progressive-web-apps.md`)
- `scripts/tablet-start.sh` — bindet `0.0.0.0:3001`, `termux-wake-lock`, `plan:today`

## Part 1 — PWA (Code, im Repo)

### Komponenten

| Unit | Datei | Zweck |
|------|-------|-------|
| Icon-Generator | `web/scripts/gen-icons.mjs` | rendert SVG → PNGs (Run-once, `sharp` devDep) |
| PNG-Icons | `web/public/icon-192.png`, `icon-512.png`, `icon-512-maskable.png`, `apple-icon-180.png` | committet, kein Runtime-Dep |
| Manifest | `web/public/manifest.webmanifest` | Icon-Einträge SVG→PNG, SVG als Bonus `any` |
| Layout-Metadata | `web/src/app/layout.tsx` | `icons.icon`/`icons.apple` → PNG |
| Service-Worker | `web/public/sw.js` | minimal: install/activate/fetch, Offline-Fallback |
| SW-Registrierung | `web/src/app/sw-register.tsx` (client component) | registriert `/sw.js`, guard secure context |
| Header-Config | `web/next.config.ts` | `headers()`: sw.js no-cache + Security-Header |

### Detail

- **Icon-Generator:** `sharp` als devDependency. Quelle = bestehendes Haus-SVG
  (`web/public/icon.svg`, teal `#0f766e`). Erzeugt: `icon-192.png` (192²),
  `icon-512.png` (512²), `icon-512-maskable.png` (512² mit Safe-Zone-Padding ~10%),
  `apple-icon-180.png` (180²). PNGs werden committet. Script bleibt für Regen.
- **Manifest:** static `public/manifest.webmanifest` beibehalten (Tests zeigen
  dorthin). Icon-Array auf PNG umstellen (192 `any`, 512 `any`, 512 `maskable`),
  SVG zusätzlich als `any` belassen. Übrige Felder unverändert.
- **layout.tsx:** `icons.icon` → `/icon-512.png` (oder SVG+PNG), `icons.apple`
  → `/apple-icon-180.png`. `appleWebApp` + `viewport.themeColor` bleiben.
- **Service-Worker (`public/sw.js`):** minimal, **kein Push**.
  - `install` → `self.skipWaiting()`
  - `activate` → `self.clients.claim()`
  - `fetch` → network-first für Navigations-Requests; bei Netzwerk-Fehler
    Offline-Fallback aus Cache. Statische Shell-Assets (Icons, Manifest)
    cache-first. **Niemals Task-Daten cachen** (Dashboard ist `force-dynamic`,
    Daten müssen frisch sein).
  - Offline-Fallback: schlanke gecachte Seite/Markup ("Keine Verbindung").
- **SW-Registrierung:** kleine `"use client"`-Komponente, in `layout.tsx`
  gemountet. Registriert `/sw.js` mit `scope: "/"`, `updateViaCache: "none"`.
  Guard: nur wenn `"serviceWorker" in navigator` und secure context.
- **next.config.ts `headers()`** (laut Next-Guide Abschnitt 8):
  - global `/(.*)`: `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`,
    `Referrer-Policy: strict-origin-when-cross-origin`
  - `/sw.js`: `Content-Type: application/javascript; charset=utf-8`,
    `Cache-Control: no-cache, no-store, must-revalidate`

### Kein base-URL / allowedHosts nötig

Prod-`next start` schränkt den `Host`-Header nicht ein (das ist nur ein
Dev-Server-Thema → `allowedDevOrigins`). `tailscale serve` mappt Root `/` →
`start_url: "/"` bleibt gültig. Manifest + SW sind same-origin zum MagicDNS-Host
→ keine Anpassung.

## Part 2 — Tailscale-Fernzugriff (Doku + Boot-Script)

Deliverable: Runbook `docs/tablet-remote-access.md` + tailscaled in den Boot-Flow.

### Schritte (am Tablet, Termux, ohne Root)

1. `pkg install tailscale`
2. tailscaled im Userspace-Modus (kein Root):
   `tailscaled --tun=userspace-networking --socks5-server=localhost:1055 &`
3. **Account von Null:** `tailscale up` gibt Login-URL aus → Tailscale-Account
   anlegen (Google-Login mit Gmail), Tablet autorisieren.
4. **Handy:** Tailscale-App aus dem Store, gleicher Account, Handy autorisieren.
5. **Admin-Console:** MagicDNS aktivieren + HTTPS Certificates aktivieren.
6. **HTTPS-Proxy:** `tailscale serve --bg https / http://127.0.0.1:3001`
   → Tablet erreichbar unter `https://tablet.<tailnet>.ts.net` von jedem
   Tailnet-Gerät.

### Eigenschaften

- SQLite unangetastet, keine Migration.
- Keine öffentliche Exposition — nur tailnet-intern.
- Tailnet-Name (`<tailnet>.ts.net`) wird beim Setup festgestellt und in den
  Kiosk-/Boot-Configs eingetragen.

## Part 3 — Tablet-Kiosk-Autostart (Doku + Boot-Script)

### Boot-Flow (Termux:Boot)

Script in `~/.termux/boot/` (am Tablet platziert; Vorlage im Repo unter
`scripts/`). Bei Geräte-Boot:

1. `termux-wake-lock`
2. tailscaled (userspace) starten
3. Dashboard starten (bestehendes `tablet-start.sh` / `restart-dashboard.sh`)
4. `tailscale serve` reaktivieren (falls nicht persistent via `--bg`)

### Fully Kiosk Browser (Gratis-Tier)

- Start-URL = MagicDNS-HTTPS (`https://tablet.<tailnet>.ts.net`)
- aktivieren: **Start on Boot**, **Keep Screen On**, **Fullscreen**,
  **Auto-reload on reconnect**
- Auto-reload deckt die Boot-Race ab (Fully lädt evtl. bevor Server bereit →
  retryt automatisch).

### Display bleibt an

Fully "Keep Screen On" + Screen-Timeout deaktiviert; serverseitig zusätzlich
`termux-wake-lock`.

### Runbook

`docs/tablet-kiosk-setup.md` — Fully-Settings, Boot-Reihenfolge,
Termux:Boot-Installation.

## Testing / Verification

- **vitest** (`npx vitest run`):
  - `manifest.test.ts` erweitern: PNG-Icons vorhanden, 192/512/maskable,
    apple-touch deklariert.
  - neu `sw.test.ts`: `public/sw.js` existiert, registriert `install`/
    `activate`/`fetch`.
- **typecheck + lint** clean.
- **Tablet-Build + manuelle Verifikation:**
  - Build am Tablet (`git pull --ff-only && cd web && npx next build --webpack &&
    bash ~/restart-dashboard.sh`).
  - PWA am Handy über HTTPS-MagicDNS installieren → standalone, keine Toolbar.
  - Tablet rebooten → Kiosk startet automatisch im Vollbild.

## Deliverables

| Typ | Pfad |
|-----|------|
| Code | `web/scripts/gen-icons.mjs`, `web/public/*.png`, `web/public/sw.js`, `web/src/app/sw-register.tsx`, geänderte `manifest.webmanifest` / `layout.tsx` / `next.config.ts` |
| Tests | erweiterte `web/src/app/manifest.test.ts`, neue `web/src/app/sw.test.ts` |
| Doku | `docs/tablet-remote-access.md`, `docs/tablet-kiosk-setup.md` |
| Boot | Vorlage-Script unter `scripts/` (am Tablet nach `~/.termux/boot/`) |

## Risiken / offene Punkte

- `tailscale serve` HTTPS braucht im Tailnet aktivierte HTTPS-Certificates +
  MagicDNS — wird im Runbook als Voraussetzung dokumentiert.
- userspace-networking: tailscaled akzeptiert Inbound + `serve` proxyt lokale
  Ports korrekt; kein Root nötig. Falls `serve` im Userspace-Modus zickt →
  Fallback dokumentieren.
- Boot-Reihenfolge-Race (Fully vor Server) → durch Auto-reload abgefangen.
