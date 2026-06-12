# Dashboard am Pixel Tablet (Termux) betreiben

Das Dashboard läuft als Node-Server direkt am Tablet; Chrome zeigt es als
installierte PWA. Möglich, weil Prisma den **better-sqlite3 Driver-Adapter**
nutzt — die Rust-Query-Engine (üblicher Android-Blocker) entfällt, nur
`better-sqlite3` wird nativ gebaut.

## Einmalige Einrichtung

1. **Termux** installieren (F-Droid empfohlen, aktueller als Play Store).
   Optional **Termux:Boot** für Autostart.
2. Pakete installieren:
   ```sh
   pkg update && pkg install nodejs-lts git python clang make termux-api
   ```
3. Repo holen und Abhängigkeiten installieren (baut `better-sqlite3` nativ):
   ```sh
   git clone <REPO-URL> haushalts-dashboard
   cd haushalts-dashboard/web
   npm ci
   ```
4. Umgebung anlegen:
   ```sh
   cp .env.example .env
   # .env reicht mit DATABASE_URL; Google/Bring optional.
   ```
5. Datenbank vorbereiten und Chores importieren:
   ```sh
   npx prisma migrate deploy
   node node_modules/prisma/build/index.js generate
   npm run import:chores
   ```
   > Optional für eine *saubere* Echt-DB ohne Demo-Daten: vor `import:chores`
   > **keinen** Demo-Seed laufen lassen. Der Import ist additiv (Upsert nach
   > Titel) und löscht nichts.
6. Produktions-Build:
   ```sh
   npm run build
   ```

## Starten

```sh
cd ~/haushalts-dashboard
bash scripts/tablet-start.sh
```

Der Server lauscht auf `0.0.0.0:3001`. Am Tablet Chrome öffnen:
`http://localhost:3001` → Menü → **App installieren** / *Zum Startbildschirm*.
Die PWA startet danach im Vollbild.

## Wach bleiben (Kiosk)

- Tablet am Strom lassen; Android *Entwickleroptionen → „Aktiv lassen"* (beim
  Laden wach).
- `scripts/tablet-start.sh` ruft `termux-wake-lock`, damit der Server nicht in
  Doze geht.

## Autostart (optional, Termux:Boot)

Datei `~/.termux/boot/start-dashboard.sh` anlegen:
```sh
#!/data/data/com.termux/files/usr/bin/bash
termux-wake-lock
bash ~/haushalts-dashboard/scripts/tablet-start.sh
```
Ausführbar machen: `chmod +x ~/.termux/boot/start-dashboard.sh`.

## Später: Handy-Zugriff aufs Tablet

Der Server bindet bereits `0.0.0.0`. Sobald gewünscht: Tablet-IP im WLAN
ermitteln (`ifconfig` / Router) und am Handy `http://<TABLET-IP>:3001` öffnen.
(Nicht Teil dieser Einrichtung.)

## Schneller bauen (optional)

`.next` ist portabler JS-Output und kann am PC gebaut (`npm run build`) und aufs
Tablet kopiert werden; nur `npm ci` (native Module) muss am Tablet laufen.
Default ist Build am Tablet — einfacher, weniger Fehlerquellen.
