# Handoff-Prompt — Haushalts-Dashboard in neuem Chat weiterführen

> Kopiere alles unterhalb der Linie in einen neuen Chat (im Projektordner
> `Dashboard`). Der Prompt ist in sich geschlossen.

---

Wir entwickeln gemeinsam ein **Haushalts-Dashboard**. Konzept, Design und eine erste lauffähige UI stehen bereits — deine Aufgabe ist es, die **echte Funktionalität** umzusetzen. **Fang aber NICHT direkt mit Code an** (siehe „Dein erster Schritt").

## Ziel & Kontext
- Responsives Familien-Dashboard für ein Paar mit 3 Monate altem Baby: **Emely** (in Elternzeit, den Tag über Betreuung) und **Dome** (arbeitet).
- **Oberstes Leitprinzip: den Mental Load von Emely reduzieren.** Das Dashboard plant proaktiv; „zuhause in Elternzeit" heißt NICHT „frei für Hausarbeit".
- UI-Sprache: **Deutsch**. Ruhiger, aufgeräumter Stil.

## Was schon existiert (bitte zuerst lesen)
- **Spec (maßgeblich):** `docs/superpowers/specs/2026-06-07-haushalts-dashboard-design.md` — Konzept, Verteil-Engine „Fairness-Konto", Elternzeit-Modus, Datenmodell, Risiken, Annahmen.
- **Design-Prompt:** `docs/claude-design-prompt.md`.
- **Lauffähige UI:** `web/` — Next.js 16 + React 19 + TypeScript + Tailwind v4. Pixeltreue Umsetzung des Designs.
  - **Tablet-Ansicht:** Root-Route `/` (Nur Anzeige, "Glanceable").
  - **Handy-Steuerung:** Eigene Route `/mobile` mit Bottom-Navigation-Bar (Essen, Aufgaben, Notizen, Settings) für die aktive Bedienung.
  - Mock-Daten + Typen: `web/src/lib/data.ts` ← **das ist die Andockstelle für echte Daten.**
  - Komponenten: `web/src/components/` (`tiles`, `widgets`, `header`, `dashboard`), Design-Tokens in `web/src/app/globals.css` (`@theme`).
  - Starten: `cd web && npm run dev` → http://localhost:3000.
- GitHub-Repo: `dominiquelehmann1997-ops/haushalts-dashboard` (Branch `main`).

## Was noch fehlt (Umfang der echten Umsetzung — aus der Spec)
1. **Persistente Datenhaltung** — gemeinsamer Speicher für beide Personen (Aufgaben, Konten, Pläne, Notizen, Einkauf).
2. **Verteil-Engine „Fairness-Konto"** — reine Logik, gut per TDD testbar. Pipeline: ① Personen-Filter → ② Wetter-Check (Outdoor) → ③ Verfügbarkeit (Kalender) → ④ Fairness-Ziel. Inklusive **Elternzeit-Modus** (Ziel-Aufteilung zugunsten Emelys) und **Spontan-Nachtrag** erledigter Aufgaben.
3. **Aufgaben** — Status (offen/erledigt/verschoben/nicht geschafft), wiederkehrende Routine, Projekte, „nicht erledigt rollt weiter".
4. **Google Calendar** — read-only (OAuth), liefert Termine + Verfügbarkeit. Server-seitig über Next.js Route Handlers.
5. **Wetter-API** — Anzeige + Eingabe für den Outdoor-Wetter-Check.
6. **Essensplan (Stufe 1: Rezeptbuch)** → Zutaten automatisch extrahieren → Einkaufsliste.
7. **Bring!-Push** — Zutaten in die bestehende Bring-Liste schieben. ⚠️ **Größtes Risiko:** Bring hat keine offizielle öffentliche API (nur inoffizielle REST-Schnittstelle). **Früh prüfen**, Fallback einplanen.

## Dein erster Schritt (jetzt)
Erstelle eine **detaillierte Schritt-für-Schritt-Umsetzungsliste** (noch KEIN Code):
- Zerlege die obige Arbeit in **kleine, einzeln verifizierbare Schritte** mit jeweils klarem Ziel und Abnahmekriterium.
- Schlage eine **sinnvolle Reihenfolge** vor. Empfehlung: erst Datenmodell/Persistenz, dann die **Verteil-Engine als pure, getestete Logik** (TDD), danach die Integrationen (Kalender → Wetter → Essensplan/Einkauf → Bring), zuletzt UI-Verdrahtung gegen echte Daten statt Mock.
- Für jeden Integrationsschritt: erst die **technische Machbarkeit/API klären** (besonders Bring!), dann umsetzen.
- Wenn du die `writing-plans`-Skill (Superpowers) hast, nutze sie und schreibe den Plan als Datei nach `docs/`.
- **Zeig mir die Liste und hol meine Freigabe, bevor du implementierst.** Danach arbeiten wir sie Schritt für Schritt ab.

## Arbeitsweise / Regeln
- **`web/AGENTS.md` beachten:** Next.js 16 hat Breaking Changes — vor dem Coden die Guides in `node_modules/next/dist/docs/` lesen (z.B. async Request-APIs `cookies()/headers()/params`).
- Für Bibliotheks-/API-/CLI-Doku **`ctx7` bzw. die find-docs-Skill** nutzen, nicht auf Trainingswissen verlassen (Next, Tailwind v4, Google Calendar API, Bring).
- **Design nicht verändern:** bestehende Tokens (`globals.css` `@theme`) und Komponenten wiederverwenden; Look bleibt ruhig & konsistent.
- **Jeden Schritt verifizieren:** `cd web && npm run build` muss grün bleiben; für Logik (Verteil-Engine) echte Tests schreiben und laufen lassen.
- **Secrets** (OAuth-Tokens, Bring-Zugang) nur in `.env*` (ist git-ignoriert) — **niemals committen**.
- **Nicht ungefragt committen/pushen.** Für Feature-Arbeit von `main` abzweigen und am Ende fragen.

Leg los mit der Schritt-für-Schritt-Liste.
