#!/data/data/com.termux/files/usr/bin/bash
# Nächtliches Backup des Dashboards: datierte Kopie der Produktionsdatenbank
# plus menschenlesbarer Rezept-Export als Markdown.
#
# Vorgeschichte: bis dahin gab es KEIN Backup der Tablet-DB. Der Obsidian-Vault
# war faktisch die einzige Kopie der Rezepte — und der wird von der App
# abgelöst. Dieses Script schließt die Lücke.
#
# Zwei Hälften, mit Absicht:
#   - `prod-<datum>.db` ist die vollständige, zurückspielbare Sicherung.
#   - Der Markdown-Export (RECIPE_EXPORT_PATH) ist die menschenlesbare Hälfte.
#     Zeigt er auf den alten Vault-Ordner, nimmt Obsidian Sync die Rezepte
#     weiterhin mit in die Cloud — ohne dass die App je von dort liest. Damit
#     liegt eine Kopie außerhalb des Tablets, was ein Backup auf derselben
#     SD-Karte nun mal nicht leistet.
#
# Einhängen (einmalig am Tablet, siehe Kommentar am Dateiende):
#   chmod +x scripts/tablet-backup.sh
#   termux-job-scheduler --script "$HOME/haushalts-dashboard/scripts/tablet-backup.sh" \
#     --period-ms 21600000 --persisted true
#
# Manuell: bash scripts/tablet-backup.sh [--force]
# Ohne --force passiert pro Tag nur ein DB-Snapshot (siehe unten).

set -u

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
WEB="$ROOT/web"
BACKUP_DIR="${DASHBOARD_BACKUP_DIR:-$HOME/haushalt-backups}"
LOG="$BACKUP_DIR/backup.log"
KEEP=14
FORCE=0
[ "${1:-}" = "--force" ] && FORCE=1

mkdir -p "$BACKUP_DIR"

log() {
  echo "$(date '+%Y-%m-%d %H:%M:%S') $*" | tee -a "$LOG"
}

fail() {
  log "FEHLER: $*"
  exit 1
}

# ── Produktionsdatenbank ─────────────────────────────────────────────────────
# Der Pfad steht in web/.env und wird hier ausgelesen statt fest verdrahtet:
# sonst sichert das Script nach einem Umzug der DB klaglos eine Datei, die es
# nicht mehr gibt. Relative Pfade lösen gegen web/ auf — von dort startet der
# Server (tablet-start.sh), und genau dagegen löst auch Prisma auf.
DB_URL="$(sed -n 's/^[[:space:]]*DATABASE_URL[[:space:]]*=[[:space:]]*//p' "$WEB/.env" 2>/dev/null | tail -n 1)"
[ -n "$DB_URL" ] || fail "DATABASE_URL steht nicht in $WEB/.env."

# Anführungszeichen und das file:-Präfix abstreifen.
DB_PATH="${DB_URL%\"}"; DB_PATH="${DB_PATH#\"}"
DB_PATH="${DB_PATH%\'}"; DB_PATH="${DB_PATH#\'}"
DB_PATH="${DB_PATH#file:}"
case "$DB_PATH" in
  /*) ;;
  *)  DB_PATH="$WEB/${DB_PATH#./}" ;;
esac
[ -f "$DB_PATH" ] || fail "Datenbank nicht gefunden: $DB_PATH"

SNAPSHOT="$BACKUP_DIR/prod-$(date '+%Y-%m-%d').db"

# Ein Snapshot pro Tag reicht. Der Job läuft öfter, weil Android periodische
# Jobs nicht auf eine Uhrzeit festnageln lässt und im Doze-Modus streckt: lieber
# mehrmals anklopfen und die meisten Male nichts tun, als eine Nacht auslassen.
if [ -f "$SNAPSHOT" ] && [ "$FORCE" -eq 0 ]; then
  log "DB-Snapshot für heute liegt schon vor, übersprungen."
else
  TMP="$SNAPSHOT.part"
  rm -f "$TMP"

  # `.backup` statt `cp`: die DB läuft im WAL-Modus und der Server schreibt
  # weiter. Ein plumpes cp erwischt einen zerrissenen Stand, dessen letzte
  # Transaktionen im -wal daneben liegen.
  if command -v sqlite3 >/dev/null 2>&1; then
    sqlite3 "$DB_PATH" ".backup '$TMP'" || fail "sqlite3 .backup fehlgeschlagen."
    # Billige Gegenprobe: eine abgeschnittene Kopie fällt hier auf, nicht erst
    # in dem Moment, in dem man sie braucht.
    CHECK="$(sqlite3 "$TMP" 'PRAGMA quick_check;' 2>&1)" || fail "quick_check nicht ausführbar."
    [ "$CHECK" = "ok" ] || fail "Snapshot beschädigt: $CHECK"
  else
    # Ohne sqlite3 (pkg install sqlite) bleibt nur kopieren — inklusive -wal
    # und -shm, sonst fehlen die jüngsten Transaktionen.
    log "WARNUNG: sqlite3 fehlt (pkg install sqlite), kopiere roh inkl. -wal/-shm."
    cp "$DB_PATH" "$TMP" || fail "Kopieren fehlgeschlagen."
    [ -f "$DB_PATH-wal" ] && cp "$DB_PATH-wal" "$SNAPSHOT-wal"
    [ -f "$DB_PATH-shm" ] && cp "$DB_PATH-shm" "$SNAPSHOT-shm"
  fi

  # Erst umbenennen, wenn die Kopie vollständig ist: ein abgebrochener Lauf
  # hinterlässt eine .part-Datei, keinen Snapshot, der Vollständigkeit vortäuscht.
  mv "$TMP" "$SNAPSHOT" || fail "Snapshot konnte nicht abgelegt werden."
  log "DB-Snapshot: $SNAPSHOT ($(du -h "$SNAPSHOT" | cut -f1))"
fi

# ── Rollierend: die neuesten 14 behalten ─────────────────────────────────────
# Bewusst nach Anzahl, nicht nach Alter (`find -mtime +14`): läuft der Job
# zwei Wochen nicht — Tablet aus, Termux abgeschossen — löscht die Altersregel
# den letzten Bestand mit weg. So bleiben immer 14 Stände übrig.
ls -1 "$BACKUP_DIR"/prod-*.db 2>/dev/null | sort | head -n "-$KEEP" | while read -r old; do
  rm -f "$old" "$old-wal" "$old-shm"
  log "Alter Snapshot entfernt: $(basename "$old")"
done

# ── Rezept-Export ────────────────────────────────────────────────────────────
# Nach dem DB-Snapshot, nicht davor: der Snapshot ist die eigentliche
# Sicherung und darf nicht daran scheitern, dass RECIPE_EXPORT_PATH fehlt oder
# der Vault-Ordner gerade nicht gemountet ist.
cd "$WEB" || fail "web/ nicht gefunden."
if EXPORT_OUT="$(npm run --silent export:recipes 2>&1)"; then
  log "Rezept-Export: $(echo "$EXPORT_OUT" | head -n 1)"
  exit 0
fi

log "Rezept-Export fehlgeschlagen:"
echo "$EXPORT_OUT" | tee -a "$LOG"
exit 1

# ── Einhängen am Tablet ──────────────────────────────────────────────────────
# Android-JobScheduler kennt nur Perioden, keine Uhrzeit — "jede Nacht um 3"
# gibt es nicht. Deshalb alle 6 h anklopfen; der Tagesriegel oben sorgt dafür,
# dass trotzdem genau ein Snapshot pro Tag entsteht.
#
#   termux-job-scheduler \
#     --script "$HOME/haushalts-dashboard/scripts/tablet-backup.sh" \
#     --period-ms 21600000 \
#     --persisted true
#
# ACHTUNG: termux-job-scheduler braucht die Termux:API-App (nicht nur das
# Paket). Fehlt sie, hängt der Aufruf still, statt zu meckern — siehe den
# Kommentar in tablet-boot.sh. Nach dem Einhängen einmal `termux-job-scheduler
# --pending` prüfen und am Folgetag in $BACKUP_DIR nachsehen, ob wirklich ein
# Snapshot liegt. Ein Backup, von dem man nur glaubt, dass es läuft, ist keins.
