# Rezepte-Vault (Obsidian) — Design

**Datum:** 2026-06-10
**Status:** Abgenickt (Brainstorming), bereit für Implementierungsplan
**Kontext:** Haushalts-Dashboard (`web/`, Next.js + Prisma/SQLite + Vitest). Rezepte sollen künftig in einem Obsidian-Vault (Markdown) gepflegt werden statt nur als DB-Seed — als Pflege- und Kochoberfläche, geräteübergreifend per Obsidian-Sync. Das Dashboard liest den Vault.
**Verwandt:** [2026-06-10-sanftes-lernen-design.md](2026-06-10-sanftes-lernen-design.md) — Feature A (Essensplan-Gewichtung) bezieht das `rating` aus dem Vault-Frontmatter; dieser Vault ist Voraussetzung dafür.

## Motivation

Heute liegen Rezepte als `Recipe`/`Ingredient` in der SQLite-DB; es gibt **kein UI zum Anlegen/Bearbeiten**, nur einen Tausch-Picker beim Planen (`listRecipes`). Rezepte in einem Obsidian-Vault (ein `.md` pro Rezept) zu pflegen bringt:

- eine bequeme Pflege-/**Kochansicht** direkt in Obsidian (Markdown rendert die Schritte),
- **geräteübergreifenden Zugriff** über **Obsidian Sync** (vom Auftraggeber bestätigt) — passt zu „App läuft nur lokal, kein Host", weil Obsidian die Synchronisation übernimmt und das Dashboard nur die lokal gesyncte Kopie liest. `RECIPE_VAULT_PATH` zeigt entsprechend auf die **lokal gesyncte Vault-Kopie auf der Dashboard-Maschine**,
- einfaches **Sammeln aus verschiedenen Quellen** über einen gestaffelten Import.

## Source of Truth

**Vault = Wahrheit, DB = Cache.** Rezepte werden im Vault gepflegt; ein Ingest-Schritt spiegelt sie in `Recipe`/`Ingredient`. Der Essensplaner und die Einkaufsliste lesen weiter aus der DB (kaum Umbau), editiert wird nur im Vault. Klare Trennung, relationale Queries bleiben erhalten.

## Abschnitt 1 — Markdown-Schema

Eine `.md`-Datei pro Rezept. Strukturierte Felder im Frontmatter, Zubereitung als Body.

```markdown
---
id: kokos-curry-linsen          # stabiler Anker (s. Abschnitt 2), nie ändern
name: Kokos-Curry mit Linsen
rating: favorit                 # favorit | ok | selten  → Feature A
simple: true
reheatable: true
tags: [curry, vegan]
servings: 4                     # skalierbar in der Kochansicht
prepMinutes: 15
cookMinutes: 25
nutrition:                      # optional, ganzer Block weglassbar
  kcal: 540
  protein: 22
ingredients:
  - { name: rote Linsen,    amount: 200, unit: g,   freshness: haltbar }
  - { name: Kokosmilch,     amount: 400, unit: ml,  freshness: haltbar }
  - { name: Spinat,         amount: 100, unit: g,   freshness: frisch }
---

## Zubereitung
1. Zwiebeln anschwitzen …
2. Linsen + Kokosmilch zugeben, 20 min köcheln …
3. Spinat unterheben, abschmecken.
```

**Cache-Aufteilung:**

- **In die DB gespiegelt** (was Planer + Einkaufsliste brauchen): `id`→`slug`, `name`, `rating`, `simple`, `reheatable`, `tags`, und die `ingredients` (Name/Menge/Einheit + `freshness`→`Ingredient.category`).
- **Nur im Markdown** (für die Obsidian-Kochansicht, das Dashboard braucht's nicht): `servings`, `prepMinutes`/`cookMinutes`, `nutrition`, Zubereitungsschritte.

**Überschneidung mit Feature C1 (Haltbarkeits-Override):** Frontmatter-`freshness` ist der **explizite Default pro Rezept-Zutat**. Das gelernte C1-Override greift für Zutaten *ohne* Angabe bzw. als globale Korrektur. Auflösungsreihenfolge bei der Frische-Bestimmung: **Frontmatter-Angabe → C1-Override → Keyword-Heuristik**.

## Abschnitt 2 — Identität & Ingest

**Stabile Identität.** Jede Datei trägt `id` (menschenlesbarer Slug, einmal vergeben, nie geändert). Der Cache bekommt `Recipe.slug String @unique` (analog `CalendarEvent.externalId`). Ingest **upserted nach `slug`** → der interne `Recipe.id` (cuid), auf den `MealPlanEntry.recipeId` zeigt, bleibt über Datei-Edits/-Umbenennungen stabil.

**Ingest-Ablauf:**

1. Vault-Ordner aus Config lesen — neues Env `RECIPE_VAULT_PATH` (zeigt auf den Rezepte-Unterordner).
2. Alle `*.md` einlesen, Frontmatter parsen (`gray-matter`). `_template.md` und Dateien ohne gültiges Frontmatter werden übersprungen.
3. Pro Rezept: `Recipe` per `slug` upserten, zugehörige `Ingredient`-Zeilen ersetzen.
4. **Orphan-Handling:** Cache-Rezepte, deren `slug` nicht mehr im Vault liegt → `Recipe.archived=true` (neues Feld) statt löschen. Planer wählt sie nicht mehr; bestehende `MealPlanEntry`-Verweise lösen weiter auf.
5. **Robust:** kaputtes Frontmatter → Datei überspringen + in einem Ergebnis-Report melden (n importiert / n Fehler), kein Crash.
6. **Slug-Komfort:** fehlt `id` im Frontmatter, leitet der Ingest den Slug aus dem Dateinamen ab.

**Trigger** (lokal, kein Scheduler): manueller **„Vault einlesen"-Button** (Server-Action) + Ingest beim App-Start. File-Watch/Automatik ist spätere Ausbaustufe.

**Reine Funktion:** `parseRecipeMarkdown(content) → { recipe, ingredients, errors }` → Unit-getestet mit Beispiel-Markdown. Der DB-Teil (Upsert/Archivierung) ist eine dünne Repository-Funktion.

## Abschnitt 3 — Import-Weg (drei Stufen, nach Aufwand/Kosten gestaffelt)

### Stufe 1 — Vorlage + manuell (jetzt)

- Dokumentierte Vorlagedatei `_template.md` im Vault mit dem kompletten Schema als Platzhalter; in Obsidian duplizieren und ausfüllen. Tool-agnostisch (kein Plugin nötig).
- Rezept aus dem Web von Hand ins Schema übertragen.

### Stufe 1.5 — Claude-Skill „Rezept → Vault-Markdown" (nahezu geschenkt)

- Ein Skill im Projekt unter `.claude/skills/` (mit dem Schema versioniert). Eingabe: roher Text / URL / Foto. Ausgabe: fertige, schema-konforme `.md`.
- Zwei Nutzungswege:
  - **In Claude Code:** der Skill schreibt die Datei direkt in den Vault (`RECIPE_VAULT_PATH/<slug>.md`).
  - **In claude.ai / anderswo:** er gibt den Markdown-Block aus, Nutzer kopiert selbst.
- Läuft über das **Claude-Abo — kein API-Key, keine Pro-Aufruf-Kosten.** Die erzeugte `.md` validiert beim Ingest über dasselbe `parseRecipeMarkdown`.

### Stufe 2 — In-App-Import (später, API-Key)

- Innerhalb des Dashboards: „URL/Text rein → Rezept anlegen". Bei URL: Seite scrapen → Text; dann LLM (Claude API) konvertiert **einmalig** ins Schema-Markdown.
- Vertretbarer LLM-Einsatz: einmalig beim Import, nicht im Loop. Braucht API-Key, laufende Kosten.
- Sicherheitsnetz: erzeugtes Markdown läuft durch `parseRecipeMarkdown`; Nutzer bestätigt vor dem Schreiben in den Vault. Kein ungeprüftes Schreiben.

## Schema-Änderungen (Zusammenfassung)

Am Cache-Modell `Recipe`:

- `slug String @unique` — stabiler Anker aus dem Frontmatter-`id`
- `archived Boolean @default(false)` — Orphan-Markierung
- `rating String @default("ok")` — `"favorit" | "ok" | "selten"` (aus Frontmatter; genutzt von Feature A)

`servings`/Zeiten/Nährwerte/Schritte werden **nicht** in die DB übernommen (nur Vault). `Ingredient.category` wird aus Frontmatter-`freshness` gefüllt.

Neues Env: `RECIPE_VAULT_PATH`.

> Hinweis (Projekt-Memory): nach `prisma migrate dev` immer `node node_modules/prisma/build/index.js generate` ausführen. `web/src/generated` ist gitignored.

## Reine Funktionen & Tests

| Funktion | Zweck |
|---|---|
| `parseRecipeMarkdown(content)` | Frontmatter+Body → `{recipe, ingredients, errors}`, validiert |
| `slugFromFilename(name)` | Fallback-Slug, wenn `id` fehlt |

Ingest-Upsert/Archivierung als dünne, integrationsgetestete Repository-Funktion.

## Build-Reihenfolge (Teilprojekt)

- **V1:** Schema + `parseRecipeMarkdown` + Ingest (Upsert/Archiv) + `_template.md` + `RECIPE_VAULT_PATH` + „Vault einlesen"-Action + Cache-Felder (`slug`, `archived`, `rating`). → **Voraussetzung für Feature A** der Lern-Spec.
- **V1.5:** Claude-Skill (Stufe 1.5).
- **V2:** In-App-LLM-Import (Stufe 2) — späteste Ausbaustufe.

## Nicht-Ziele

- Kein eigenes Rezept-Editier-UI im Dashboard (das macht Obsidian).
- Keine Kochansicht im Dashboard (Schritte/Portionen/Nährwerte leben im Vault, Obsidian rendert sie).
- Kein automatischer File-Watch in V1 (manueller Ingest + Start-Ingest reichen).
- Keine geräteübergreifende Dashboard-Synchronisation (nur der Vault synct; das Dashboard bleibt lokal).
