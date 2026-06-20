#!/data/data/com.termux/files/usr/bin/bash
# Stündlicher Kalender-Sync + Neu-Verteilung der heute fälligen Aufgaben.
# Eingehängt via termux-job-scheduler (siehe Step 6). Idempotent, gefahrlos.
set -e
cd "$(dirname "$0")/../web"
npm run sync:calendar || true
npm run plan:today || true
