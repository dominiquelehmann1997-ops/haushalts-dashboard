# Baby-Wetter / Kleidungsempfehlung — Feature-Plan

> **For agentic workers:** REQUIRED SUB-SKILL: `superpowers:subagent-driven-development` (empfohlen) oder `superpowers:executing-plans`. Schritte nutzen Checkbox-Syntax (`- [ ]`).
>
> Dies ist ein eigenständiger Feature-Plan (Erweiterung des bestehenden Dashboards aus `docs/superpowers/plans/2026-06-07-haushalts-dashboard-umsetzung.md`). Design-Verträge + Abnahmekriterien; vollständiger TDD-Code wird je Task bei der Umsetzung geschrieben.

**Goal:** Ein dezentes „Baby-Wetter"-Fenster auf dem Dashboard, das aus dem aktuellen Wetter eine konkrete **Kleidungsempfehlung für die Kleine** (nach dem Zwiebelprinzip), einen **UV-Schutz-Hinweis** und den **Nackentest-Tipp** ableitet — angelehnt an [baby-wetter.de](https://baby-wetter.de/), aber mit eigener Logik.

**Architecture:** Reine, getestete Empfehlungslogik (`engine`-Stil, kein I/O) + Erweiterung der bestehenden Open-Meteo-Integration um den UV-Index. Eine neue, ruhige UI-Karte konsumiert Temperatur/UV (Server-seitig geladen) und lokal wählbare Situation/Alters-Band. Look bleibt konsistent zum bestehenden Design.

**Tech Stack:** Next.js 16 · React 19 · TS · Tailwind v4 · Open-Meteo (vorhanden) · Vitest. Keine neuen externen Dienste.

---

## Wichtige Entscheidungen / Leitplanken

| Thema | Entscheidung | Begründung |
|---|---|---|
| **Empfehlungslogik** | **Eigene** Temperatur→Kleidung-Zuordnung nach dem (allgemein bekannten) **Zwiebelprinzip** schreiben | baby-wetter.de dient nur als **Inspiration**; deren konkrete Tabellen sind fremdes Werk und werden **nicht** übernommen/gespiegelt. Zwiebelprinzip + Nackentest sind Allgemeingut. |
| **Wetterquelle** | Bestehende **Open-Meteo**-Integration erweitern (UV-Index) | Kein zweiter Dienst, kein API-Key. baby-wetter.de nutzt OpenWeather — wir bleiben bei unserer Quelle. |
| **Baby-Alter** | Standard **„0–3 Monate"** (aktuelle Lebensphase), umschaltbar auf „4+ Monate" | Eure Tochter ist ~3 Monate. Optionaler Ausbau: Geburtsdatum hinterlegen → Alter automatisch (siehe „Spätere Ausbaustufen"). |
| **Situationen** | Kinderwagen · Babytrage · Auto · Schlafen · Zuhause · Allgemein | Wie auf baby-wetter.de — beeinflusst die Schichten (z. B. Auto: keine dicke Jacke; Babytrage: Körperwärme der Eltern). |
| **Platzierung** | Neue ruhige Karte; Default-Empfehlung: in der **Widget-Reihe** als zusätzliche Karte (Grid auf flexibles Wrapping anpassen) | Hält das Hero-Band glanceable; die Karte ist sekundär. (Alternative in Task 4 dokumentiert.) |
| **Haftungshinweis** | Kurzer Disclaimer + Nackentest-Hinweis in der Karte | Wärmeempfinden ist individuell — Empfehlung ist Orientierung, kein medizinischer Rat. |

---

## Datei-Struktur

```
web/src/
  lib/baby/
    clothing.ts        # REINE Logik: Temperatur+Situation+Alter → Kleidungs-Schichten
    clothing.test.ts
    uv.ts              # REINE Logik: UV-Index → Schutz-Empfehlung
    uv.test.ts
    types.ts           # Situation, AgeBand, ClothingAdvice, UvAdvice
  integrations/weather/
    openMeteo.ts       # erweitern: UV-Index in getCurrent()/mapCurrent() (+ Mapper-Test)
    openMeteo.test.ts
  components/
    BabyWeatherCard.tsx  # "use client": Situation/Alter-Auswahl + Anzeige (ruhiger Look)
  app/
    page.tsx           # erweitern: uvIndex an Dashboard durchreichen
  components/dashboard.tsx  # BabyWeatherCard einhängen
```

---

## Task 1 — Open-Meteo um UV-Index erweitern

**Files:** `web/src/integrations/weather/openMeteo.ts` (+ `.test.ts`, `fixture.ts`)

- [ ] **1.1** API-Parameter prüfen (find-docs/ctx7): `current=...,uv_index`, `daily=...,uv_index_max`, `hourly=...,uv_index` bei Open-Meteo.
- [ ] **1.2** `mapCurrent(raw)` (pure) um `uvIndex: number` erweitern (gerundet, aus `current.uv_index`; Fallback aus heutigem `daily.uv_index_max` falls `current` fehlt). Bestehende Felder unverändert.
- [ ] **1.3** Fixture um UV-Werte ergänzen; Test: `mapCurrent(fixture).uvIndex` korrekt.
- [ ] **1.4** `getCurrent()` (Netzwerk) liefert `uvIndex` mit; URL um die UV-Parameter erweitern.

**Abnahme:** `mapCurrent`-Test grün inkl. UV; `npm run typecheck`/`build` grün; bestehende Wetter-Tests weiter grün.

---

## Task 2 — Kleidungs-Empfehlung (reine Logik, TDD)

**Files:** `web/src/lib/baby/{types,clothing}.ts` (+ `clothing.test.ts`)

**Design-Vertrag (`types.ts`):**
```ts
export type Situation = "kinderwagen" | "babytrage" | "auto" | "schlafen" | "zuhause" | "allgemein";
export type AgeBand = "0-3m" | "4m+";
export interface ClothingAdvice {
  tempBand: string;          // z.B. "13–17 °C"
  layers: string[];          // Zwiebel-Schichten, z.B. ["Body langarm","Strampler","Pulli","Jacke","Mütze"]
  warmth: "heiß" | "warm" | "mild" | "kühl" | "kalt" | "frost";
  hint?: string;             // situations-/altersspezifischer Zusatz (z.B. "Im Auto keine dicke Jacke")
}
```

- [ ] **2.1** `recommendClothing(input: { tempC: number; situation: Situation; ageBand: AgeBand }): ClothingAdvice` — **eigene** Temperaturbänder (z. B. ≥28 / 23–27 / 18–22 / 13–17 / 8–12 / 3–7 / <3 °C) → Basis-Schichten nach Zwiebelprinzip; dann situations-/alters-abhängige Anpassung:
  - `auto`: keine dicke Jacke (Gurt-Sicherheit) → Decke/Fußsack-Hinweis statt Jacke.
  - `babytrage`: eine Schicht weniger (Körperwärme), Extremitäten (Mütze/Söckchen) betonen.
  - `kinderwagen`: bei Kälte Fußsack/Decke-Hinweis.
  - `schlafen`: Schlafsack passend zur Temperatur, **keine** losen Decken (Hinweis).
  - `0-3m`: tendenziell eine Schicht mehr; bei Sonne „nicht in direkte Sonne".
- [ ] **2.2** Tests für repräsentative Fälle: heißer Tag (28°, allgemein, 0-3m) → leichte Schichten + Sonnenhut-Hinweis; milder Tag (15°, kinderwagen, 0-3m) → mehrere Schichten + Fußsack-Hinweis; Frost (1°, auto) → warme Schichten **ohne** dicke Jacke + Decken-Hinweis; schlafen (20°) → Schlafsack-Hinweis. Jeder Test prüft `warmth`, mindestens eine erwartete Schicht und den situations-spezifischen `hint`.

**Abnahme:** alle Clothing-Tests grün; Modul importiert kein db/next/integration (pure).

---

## Task 3 — UV-Schutz-Empfehlung (reine Logik, TDD)

**Files:** `web/src/lib/baby/uv.ts` (+ `uv.test.ts`)

**Vertrag:**
```ts
export interface UvAdvice { index: number; level: "niedrig"|"mäßig"|"hoch"|"sehr hoch"|"extrem"; advice: string; }
```
- [ ] **3.1** `uvAdvice(index: number, ageBand: AgeBand): UvAdvice` — Standard-WMO/WHO-UV-Stufen (0–2 niedrig, 3–5 mäßig, 6–7 hoch, 8–10 sehr hoch, 11+ extrem). Für **0-3m**: ab „mäßig" deutlicher Hinweis „direkte Sonne meiden, Schatten, Sonnenhut" (Sonnencreme für Säuglinge nur eingeschränkt — Hinweis „Schatten/Kleidung statt Creme bei Säuglingen").
- [ ] **3.2** Tests: index 1 → niedrig/entspannt; index 4 + 0-3m → mäßig + Schatten-Hinweis; index 8 → sehr hoch + klare Warnung.

**Abnahme:** UV-Tests grün; Modul pure.

---

## Task 4 — UI-Karte „Baby-Wetter"

**Files:** `web/src/components/BabyWeatherCard.tsx`; `web/src/app/page.tsx`; `web/src/components/dashboard.tsx`

- [ ] **4.1** `page.tsx`: aus `getCurrent()` zusätzlich `uvIndex` an `Dashboard` durchreichen (Fallback wie bisher).
- [ ] **4.2** `BabyWeatherCard` (`"use client"`) im **bestehenden Look** (`Card`/`CardHead`, gleiche Tokens, ruhig):
  - Kopf „Baby-Wetter · Heute" + aktuelle Temperatur (aus props).
  - Kleine Auswahl: **Situation** (6 Chips, Default „allgemein") + **Alter** (0-3m / 4+m, Default 0-3m) via lokalem `useState`.
  - Anzeige: `recommendClothing(...)` → Schichten als Liste/Chips + `hint`; `uvAdvice(...)` → UV-Stufe + Hinweis (nur sichtbar wenn relevant, z. B. UV ≥ 3).
  - Dezenter Fußzeilen-Hinweis: „Orientierung — mach im Zweifel den **Nackentest**" + 1-Satz-Disclaimer.
  - Keine Netzwerkaufrufe in der Komponente; rein aus props + lokaler Auswahl.
- [ ] **4.3** Platzierung: als zusätzliche Karte in der Widget-Reihe einhängen; Grid auf flexibles Wrapping anpassen (z. B. `xl:grid-cols-4` beibehalten und die Karte in eine zweite Reihe wandern lassen, oder bewusst als 5. Karte mit `flex-wrap`). **Alternative** (falls bevorzugt): direkt unter die Wetter-Kachel im Hero-Band. Look ruhig halten, nichts Bestehendes umstylen.

**Abnahme:** `npm run dev` zeigt die Karte; Wechsel von Situation/Alter ändert die Empfehlung sofort (clientseitig); `npm run build`/`typecheck`/`test` grün; Default-Dashboard wirkt unverändert ruhig (Karte fügt sich ein).

---

## Self-Review (Abdeckung)

- Kleidungsrechner (Temp + Situation + Alter) → Task 2 + 4.
- UV-Schutz → Task 1 (UV-Daten) + Task 3 + 4.
- Nackentest-/Disclaimer-Hinweis → Task 4.2.
- Wetterquelle ohne neuen Dienst/Key → Task 1 (Open-Meteo-Erweiterung).
- Eigene Logik statt Kopie fremder Tabellen → Leitplanken + Task 2/3.

## Spätere Ausbaustufen (nicht jetzt)

- **Geburtsdatum** der Kleinen hinterlegen → Alter automatisch + „Baby ist X Wochen alt" (wie baby-wetter.des Alters-Rechner).
- **Luftqualität** (Open-Meteo Air-Quality-API) als weiterer Hinweis.
- **Tagesverlauf**: Empfehlung für später am Tag (z. B. Nachmittag kühler) statt nur „jetzt".
- Persistente Merkung der zuletzt gewählten Situation.
```
