# Backlog / Roadmap — Handy-Steuerung, dienstplan-bewusster Essensplan & Einkauf

> **Status:** Ideen-Backlog (Gedanken des Auftraggebers, festgehalten am 2026-06-08).
> Noch **keine** Design-Specs — jeder Punkt wird vor der Umsetzung einzeln per
> `superpowers:brainstorming` → `writing-plans` zu Spec + TDD-Mikroplan
> ausgearbeitet. Reihenfolge: A (erledigt) → B → C → D.

## Leitidee (langfristig)

Das Dashboard wird **vom Handy gesteuert**, das **Tablet zeigt** überwiegend an
(always-on, glanceable). Interaktive Funktionen wie **Abhaken** bleiben auch auf
dem Tablet möglich. „Handy steuert" wird konkret vor allem durch die Freigabe-/
Bearbeiten-Flows unten eingelöst (Schritt C) — kein eigener großer Bau nötig,
sondern eine Linse auf die folgenden Schritte.

---

## A · Dienst-Zeiten + Schlaf — ✅ ERLEDIGT (2026-06-08)

Nacht/LN sind im Kalender nur bis 23:59 eingetragen, laufen real bis 05:30
Folgetag; danach Schlaf bis ~14:00. Korrigiert in `getBusyWindows`
(`web/src/lib/repositories/calendar.ts`) + reiner Erkenner
`web/src/lib/calendar/shifts.ts`. Reine Datenkorrektheit, Fundament für B.

---

## B · Dienstplan-bewusster Essensplan — ✅ ERLEDIGT (2026-06-09)

Umgesetzt: `classifyShift` (Früh/Spät/LT/Nacht) +
`deriveDayConstraints` (rein) leiten je Wochentag die Koch-Constraints aus
Domes Schichten ab; `generateWeekPlan` wählt passende Rezepte und persistiert
`reason`/`extraPortion`; Server Action verdrahtet Schichten→Constraints→Planer;
die Essensplan-Kachel zeigt ein Badge je Tag. Neues Rezept-Flag `reheatable`.
Spec/Plan: `docs/superpowers/specs/2026-06-09-dienstplan-bewusster-essensplan-design.md`,
`docs/superpowers/plans/2026-06-09-dienstplan-bewusster-essensplan.md`.

Der Essensplan-Entwurf orientiert sich nun am **Kalender / Dienstplan** statt
nur Rezepte zu mischen (`web/src/lib/services/mealPlanner.ts`).

Umgesetzte Regeln:
- **Dome hat Spätdienst** → an dem Tag **schnelle, einfache Gerichte**, damit
  **Emely** sie allein machen kann, während sie Kaya betreut.
- **Tag vor Domes Spätdienst** oder **Tag von Domes Nachtdienst** → Gerichte,
  die sich **gut aufwärmen** lassen (+ Extraportion), damit Dome sie sich **bei
  der Arbeit aufwärmen** kann.

Hängt an: A (korrekte Dienst-Verfügbarkeit). Sichtbarer Mehrwert dieses Schritts.

> Offen für später: „Extraportion" ist aktuell nur ein sichtbarer Marker —
> echte Einkaufsmengen/Haltbarkeit folgen in Schritt D.

---

## C · Essensplan-Entwurf → Push an beide Handys → abnicken/ändern

- Entwurf des Wochenplans wird **zu Wochenbeginn** bzw. in einem **Zeitfenster,
  in dem beide zuhause sind**, automatisch erzeugt.
- **Benachrichtigung an Domes und Emelys Handy.**
- Beide schauen den Plan an und **nicken ihn ab** oder **nehmen Änderungen vor**.

Vermutlich nötig (größter Brocken):
- **Auslöser/Zeitfenster** (wann „beide zuhause" — evtl. aus Kalender ableiten).
- **Benachrichtigungskanal zum Handy** — offene Entscheidung: Web-Push/PWA,
  Telegram-Bot, Todoist oder E-Mail.
- **Entwurfs-Zustand** des Plans (pending) + **Freigabe-/Bearbeiten-Aktion**
  (gut bedienbar am Handy → zahlt auf die Leitidee ein).

Hängt an: B (es wird ja der dienstbewusste Plan freigegeben).

---

## D · Einkauf als verteilte Aufgabe — Timing & Haltbarkeit

- Einkaufen fällt **mit in die Aufgabenverteilung**.
- **Sinnvolle Termine** dafür finden: z.B. wenn einer **eh unterwegs** ist und
  **auf dem Weg** einkauft (Kalender nach Terminen-mit-Ort durchsuchen).
- Einkaufsliste entsprechend erstellen und auf **Haltbarkeit** der Lebensmittel
  achten (nah am Verbrauch einkaufen).

Vermutlich nötig (datenintensiv, daher zuletzt):
- Einkauf als planbare Aufgabe in der Verteil-Engine.
- Termin-mit-Ort-Erkennung im Kalender für „auf dem Weg".
- Haltbarkeits-/Shelf-Life-Info pro Zutat.

Hängt an: B/C (Plan → Zutaten → Einkauf) und A (Verfügbarkeit/Timing).
