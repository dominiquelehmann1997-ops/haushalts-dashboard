#!/data/data/com.termux/files/usr/bin/bash
# Startet das Haushalts-Dashboard am Tablet. Aufruf: bash scripts/tablet-start.sh
# (auch via Termux:Boot). Bindet 0.0.0.0 -> spaeterer Handy-Zugriff im WLAN frei.
set -e

# Doze/Sleep des Servers verhindern, solange er laeuft.
termux-wake-lock 2>/dev/null || true

cd "$(dirname "$0")/../web"

# Produktions-Server (vorher 'npm run build' ausfuehren).
HOST=0.0.0.0 npm run start -- -H 0.0.0.0 -p 3001
