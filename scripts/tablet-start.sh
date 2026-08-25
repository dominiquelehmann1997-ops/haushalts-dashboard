#!/data/data/com.termux/files/usr/bin/bash
# Startet das Haushalts-Dashboard am Tablet. Aufruf: bash scripts/tablet-start.sh
# (auch via Termux:Boot). Bindet 0.0.0.0 -> spaeterer Handy-Zugriff im WLAN frei.
set -e

# Doze/Sleep des Servers verhindern, solange er laeuft.
termux-wake-lock 2>/dev/null || true

cd "$(dirname "$0")/../web"

# Google-Kalender vor der Verteilung syncen, damit die Engine frische Termine/
# Schichten sieht. Fehler (offline/nicht verbunden) darf den Start nicht blockieren.
npm run sync:calendar || true

# Heute faellige, noch unverteilte Aufgaben ueber die Fairness-Engine zuweisen.
# Idempotent (ruehrt bereits zugewiesene Tasks nicht an); Fehler darf den Start
# nicht blockieren.
npm run plan:today || true

# Nächtliches Backup als Schleife nebenher (DB-Snapshot + Rezept-Export).
# termux-job-scheduler wäre der naheliegende Weg, hängt auf diesem Tablet aber
# still — die Termux:API-App fehlt. Begründung im Kopf von tablet-backup-loop.sh.
# Idempotent: ein zweiter Serverstart legt keine zweite Schleife an.
if ! pgrep -f "[t]ablet-backup-loop.sh" >/dev/null 2>&1; then
  bash ../scripts/tablet-backup-loop.sh &
fi

# Produktions-Server (vorher 'npm run build' ausfuehren).
HOST=0.0.0.0 npm run start -- -H 0.0.0.0 -p 3001
