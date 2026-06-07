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

Der finale visuelle Look wird separat in Claude umgesetzt.
