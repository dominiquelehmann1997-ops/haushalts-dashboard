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

In drei Teile zerlegt: **C1** (Entwurf + Abnicken/Ändern) · **C2** (Benachrichtigung
aufs Handy) · **C3** (automatischer Auslöser „wenn beide zuhause").

### C1 · Entwurfs-Zustand + Abnicken/Ändern — ✅ ERLEDIGT (2026-06-09)

`MealPlanEntry.status` ("active" | "draft"): „Woche neu planen" erzeugt jetzt
einen **Entwurf**; die Essensplan-Kachel zeigt weiter den **aktiven** Plan, ein
separates **`MealDraftPanel`** zeigt den Entwurf mit „🎲 neu würfeln" (dienstbewusst)
und Rezept-Tausch. **Abnicken** (einer reicht) befördert den Entwurf zum aktiven
Plan und pusht erst dann die Zutaten — batch-fähig (`planShoppingBatches`, C1 eine
Rutsche) — auf Einkaufsliste + Bring; **Verwerfen** löscht den Entwurf. Spec/Plan:
`docs/superpowers/specs/2026-06-09-essensplan-entwurf-freigabe-design.md`,
`docs/superpowers/plans/2026-06-09-essensplan-entwurf-freigabe.md`.

### C2 · Benachrichtigung aufs Handy — ✅ ERLEDIGT (2026-06-18)

**Kanal: Web-Push (PWA).** Der frühere Blocker (kein öffentlicher HTTPS-Host)
ist weg — der Cloudflare-Tunnel (`cockpit.domelehmann.org`) liefert public HTTPS.
`generatePlanAction` ruft nach der Entwurfserzeugung `sendToAdults` (non-fatal,
selbstheilend bei 410/404); der Service-Worker zeigt die Notification, Tap öffnet
die App. Geräte melden sich per `PushSetupControl` an (🔔 + Person-Picker), gemountet
auf der Phone-UI unter `/mobile/settings`. Nur bei **neuem** Entwurf (nicht
Reroll/Tausch). Web-Push gewählt statt Telegram/Todoist/E-Mail: nutzt Tunnel +
Service-Worker, kein Fremdsystem.

Umgesetzt subagent-driven (7 TDD-Tasks), am Tablet deployed (Tabelle direkt via
better-sqlite3, da Prisma-migrate-engine nicht auf Android läuft; Build per
`next build --webpack`). Spec/Plan:
`docs/superpowers/specs/2026-06-17-c2-handy-push-essensplan-design.md`,
`docs/superpowers/plans/2026-06-17-c2-handy-push-essensplan.md`. Betriebs-Setup:
`web/docs/push-setup.md`.

> Offen für später: gezielte Per-Person-Pushes (`personKey` ist schon gespeichert),
> Action-Buttons in der Notification, weitere Push-Anlässe.

### C3 · Automatischer Auslöser „wenn beide zuhause" — offen

- Entwurf **zu Wochenbeginn** bzw. in einem **Zeitfenster, in dem beide zuhause
  sind**, automatisch erzeugen (evtl. aus Kalender/Verfügbarkeit ableiten).

Hängt an: B (der dienstbewusste Plan wird freigegeben). C1 ist Fundament für C2/C3.

---

## D · Einkauf als verteilte Aufgabe — Timing & Haltbarkeit

In drei Teile zerlegt: **D1** (Haltbarkeits-Batching, gestaffelter Bring-Push) ·
**D2** (Einkaufstermine „auf dem Weg" aus dem Kalender) · **D3** (Einkauf als
Aufgabe in der Verteil-/Konto-Engine).

### D1 · Haltbarkeits-Batching, gestaffelt auf Bring — ✅ ERLEDIGT (2026-06-09)

Zutaten tragen eine Haltbarkeits-Kategorie (`Ingredient.category` "frisch"/
"haltbar", per Namens-Heuristik `classifyFreshness` vorbelegt). Beim Abnicken geht
nur die **haltbar**-Rutsche sofort auf Bring (`pushRecipeBatch("haltbar")`,
`ShoppingItem.pushed`); die **frisch**-Rutsche bleibt offen und wird über den
`FreshShoppingControl` mit Vorschlagstag (Tag vor frühestem Frisch-Verbrauch) +
Knopf „Jetzt auf Bring" nachgereicht. Ersetzt den C1-Platzhalter
`planShoppingBatches`. Spec/Plan:
`docs/superpowers/specs/2026-06-09-einkauf-haltbarkeit-batching-design.md`,
`docs/superpowers/plans/2026-06-09-einkauf-haltbarkeit-batching.md`.

### D2 · Einkaufstermine „auf dem Weg" — offen

- **Sinnvolle Termine** finden: wenn einer **eh unterwegs** ist und **auf dem
  Weg** einkauft (Kalender nach Terminen-mit-Ort `place` durchsuchen). Verfeinert
  den Vorschlagstag/-ort der Frisch-Rutsche aus D1.

### D3 · Einkauf als verteilte Aufgabe — offen

- Einkaufen fällt **mit in die Aufgabenverteilung** (`Task.type:"shopping"` in die
  Verteil-/Konto-Engine einhängen).

Hängt an: B/C (Plan → Zutaten → Einkauf) und A (Verfügbarkeit/Timing). D1 ist
Fundament für D2/D3.
