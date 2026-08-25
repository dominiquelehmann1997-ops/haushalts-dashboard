#!/data/data/com.termux/files/usr/bin/bash
# Taktgeber für tablet-backup.sh — der Ersatz für termux-job-scheduler.
#
# Warum nicht der Scheduler: der braucht die Termux:API-**App** (nicht nur das
# Paket `termux-api`). Auf diesem Tablet ist sie nicht installiert, und ohne sie
# hängt `termux-job-scheduler` still, statt zu erroren — nachgemessen am
# 25.08.2026: `--pending` läuft in den Timeout, siehe auch den Kommentar in
# tablet-boot.sh. Ein Backup, das an einem stillen Hänger scheitert, wäre keins.
#
# Also eine simple Schleife neben dem Server. Gestartet von tablet-start.sh,
# lebt damit genauso lange wie der Server: Wird Termux abgeschossen, ist beides
# weg, und der dokumentierte Handgriff `bash ~/.termux/boot/tablet-boot.sh`
# bringt beides zurück.
#
# Alle 6 h anklopfen, nicht alle 24: Android streckt und verschiebt alles im
# Doze-Modus. Der Tagesriegel in tablet-backup.sh lässt trotzdem nur einen
# Snapshot pro Tag durch — lieber mehrmals vergeblich als eine Nacht auslassen.
set -u
cd "$(dirname "$0")"

while true; do
  # Fehler dürfen die Schleife nicht beenden; sie stehen im backup.log.
  bash ./tablet-backup.sh >/dev/null 2>&1 || true
  sleep 21600
done
