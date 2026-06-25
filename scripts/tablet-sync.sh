#!/data/data/com.termux/files/usr/bin/bash
# Periodischer Kalender-Sync (alle 15 Min.) + Neu-Verteilung der heute fälligen
# Aufgaben. Der Sync schreibt den Snapshot maßgeblich in die DB: in Google
# gelöschte/verschobene Termine werden dabei auch lokal entfernt — so bleibt
# kein veralteter Termin (z.B. ein bereits gelöschtes "AZT") im Dashboard hängen.
# Eingehängt via termux-job-scheduler (siehe Step 6). Idempotent, gefahrlos.
set -e
cd "$(dirname "$0")/../web"
npm run sync:calendar || true
npm run plan:today || true
