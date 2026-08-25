# Haushalts-Dashboard

Ein responsives Haushalts-Cockpit für zwei Erwachsene: gemeinsamer Google-Kalender,
automatisch verteilte Haushaltsaufgaben, automatische Essensplanung und Einkauf (Sync mit Bring!).

**Leitprinzip:** Den Mental Load reduzieren — das Dashboard plant proaktiv, statt Pflege einzufordern.

## Status

Konzeptphase. Die Design-Spezifikation liegt unter
[`docs/superpowers/specs/2026-06-07-haushalts-dashboard-design.md`](docs/superpowers/specs/2026-06-07-haushalts-dashboard-design.md).

## Kernideen

- **Layout „Heute im Fokus":** Hero-Band (Wetter · Aufgaben pro Person · Termine) + Widget-Reihe.
- **Verteil-Engine „Fairness-Konto":** Personen-Filter → Wetter-Check → Verfügbarkeit (Kalender) → Fairness.
- **Aufgaben:** wiederkehrend, einmalig, Einkauf, Projekte — mit Status & Spontan-Nachtrag.
- **Essensplan → Einkauf → Bring!:** Zutaten automatisch auf die Einkaufsliste, Push an Bring.

## Betrieb am Tablet

Das Dashboard kann lokal auf einem Android-Tablet (z.B. Google Pixel Tablet)
laufen — Node-Server in Termux, im Chrome als PWA installiert. Anleitung:
[`docs/tablet-termux-setup.md`](docs/tablet-termux-setup.md).
Die echten Haushalts-Chores werden idempotent per `npm run import:chores`
eingespielt (siehe `web/src/lib/services/chores.ts`).

## Backup

`scripts/tablet-backup.sh` legt zwei Sicherungen nebeneinander:

- eine datierte Kopie der Produktionsdatenbank (`prod-<datum>.db`, die
  neuesten 14 bleiben liegen) — das ist die vollständige, zurückspielbare
  Sicherung;
- den Rezept-Export als Markdown (`npm run export:recipes` → `RECIPE_EXPORT_PATH`)
  — die menschenlesbare Hälfte. Zeigt der Pfad auf den alten Obsidian-Vault,
  nimmt Obsidian Sync die Rezepte weiter mit in die Cloud, ohne dass die App je
  von dort liest. Damit liegt eine Kopie außerhalb des Tablets.

Getaktet wird es von `scripts/tablet-backup-loop.sh`, das `tablet-start.sh` neben
dem Server startet — alle 6 h, ein Snapshot pro Tag. Nicht per
`termux-job-scheduler`: der braucht die Termux:API-App, die auf dem Tablet
fehlt, und hängt ohne sie still, statt zu erroren.

## Rezepte per Link übernehmen

Rezeptseite raussuchen, Link im Dashboard unter *Essensplan → Rezept per Link*
einfügen (oder `npm run import:recipe -- <url>`) — das Rezept steht danach im
Rezeptbuch (*Essen → Rezepte*) und ist sofort im Essensplan wählbar.
Quellen-Empfehlungen und Details: [`docs/rezepte-quellen-und-import.md`](docs/rezepte-quellen-und-import.md).

Der finale visuelle Look wird separat in Claude umgesetzt.
