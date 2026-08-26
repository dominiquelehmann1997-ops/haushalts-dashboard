# Rezeptimport über das Dashboard — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** ObsidiDine schreibt keine Vault-Dateien mehr, sondern schickt Rohtext ans Dashboard; das extrahiert per `claude -p` (Abo, kein API-Key) und schreibt über `upsertImportedRecipe` direkt in die Rezept-DB auf dem Tablet.

**Architecture:** Zwei neue Routen im Dashboard. `POST /api/recipes/parse` nimmt Rohtext (OCR-Ergebnis, Social-Caption) plus optionale Quell-URL und liefert einen `ImportedRecipe` zurück — ohne DB-Schreibzugriff, damit die App ihren Preview-Editor behält. `POST /api/recipes/import` schreibt einen (ggf. vom Nutzer editierten) `ImportedRecipe` über den bestehenden `upsertImportedRecipe`-Pfad in die DB. Die Extraktion läuft über die `claude` CLI im Headless-Modus, die auf dem Tablet mit `CLAUDE_CODE_OAUTH_TOKEN` gegen das Claude-Pro-Abo authentifiziert ist. Der Android-Client verliert seine komplette LLM-, Markdown-, Validator- und Vault-Schicht.

**Tech Stack:** Next.js 16 (App Router, Route Handlers), Prisma + SQLite, Vitest, Kotlin/Jetpack Compose, OkHttp, kotlinx.serialization.

## Global Constraints

- **Kein `prisma migrate` auf dem Tablet.** Die migrate-engine läuft nicht auf Android ("unknown OS android"), und die Tablet-DB hat keine `_prisma_migrations`-Historie. Schema-Änderungen dort als `ALTER TABLE`-SQL direkt über `better-sqlite3`. Auf der Entwicklungsmaschine normal per `npx prisma migrate dev`.
- **Build auf dem Tablet nur mit `next build --webpack`** — Turbopack hat keine nativen Bindings auf android/arm64.
- **Modell für die Extraktion: `claude-sonnet-5`.** Am 2026-08-26 auf dem Tablet gegengeprüft (2,2 s Antwortzeit über das Abo).
- **Kein API-Key im Code, keiner in der App.** Authentifizierung der CLI ausschließlich über `CLAUDE_CODE_OAUTH_TOKEN` aus `web/.env`. Niemals `--bare` verwenden: dieser Modus liest OAuth-Credentials bewusst nicht und würde den Abo-Weg brechen.
- **Nährwerte sind immer „pro Portion".** Die DB hat kein Basis-Feld. Werte, deren Bezugsgröße nicht auf eine Portion deutet, werden verworfen, nicht umgerechnet.
- **Sprache im Produkt: Deutsch.** Fehlermeldungen, Kommentare und Doku auf Deutsch, wie im Bestand.
- **`npm run typecheck` ist Pflicht** — `next.config.ts` setzt `ignoreBuildErrors`, der Build fängt also keine Typfehler.
- Nach jedem Merge mit Schema-Änderung zuerst `npx prisma generate` (`src/generated/` ist gitignored und pro Worktree).

## File Structure

**Dashboard (`web/`)**

| Datei | Verantwortung |
|---|---|
| `prisma/schema.prisma` | `Recipe.carbs`, `Recipe.fat`, `Ingredient.section` ergänzen |
| `src/lib/repositories/recipes.ts` | `RecipeInput`/`RecipeIngredientInput` um die neuen Felder erweitern, durchreichen |
| `src/lib/services/recipeImport.ts` | `ImportedRecipe` um `carbs`/`fat`, `ImportedIngredient` um `section`; schema.org-Nährwerte erweitern |
| `src/lib/services/vegetarianTag.ts` *(neu)* | Portierung von `VegetarianHeuristic.kt` — entscheidet über den Tag `vegetarisch` |
| `src/lib/services/claudeCli.ts` *(neu)* | Gemeinsamer Wrapper um `claude -p`; heute dupliziert in `recipeIdeas.ts` |
| `src/lib/services/recipeExtract.ts` *(neu)* | Prompt, Antwort-Parsing, Repair-Retry, Mapping auf `ImportedRecipe` |
| `src/lib/api/importAuth.ts` *(neu)* | Bearer-Token-Prüfung für die beiden neuen Routen |
| `src/app/api/recipes/parse/route.ts` *(neu)* | Rohtext → `ImportedRecipe`, kein DB-Schreibzugriff |
| `src/app/api/recipes/import/route.ts` *(neu)* | `ImportedRecipe` → DB über `upsertImportedRecipe` |

**ObsidiDine (`android/app/src/main/java/de/dml/rezeptimporter/`)**

| Datei | Verantwortung |
|---|---|
| `dashboard/DashboardClient.kt` *(neu)* | HTTP gegen die zwei Routen, Draft ↔ JSON |
| `ui/ShareActivity.kt` | Verdrahtung: statt LLM-Pipeline und VaultWriter der `DashboardClient` |
| `ui/PreviewScreen.kt` | Ordner-Auswahl raus — die DB hat keine Ordner |
| `ui/MainActivity.kt` | Einstellungen: Basis-URL + Tokens statt API-Keys, Vault und Ordner raus |
| `settings/AppSettings.kt` | Felder tauschen |
| **gelöscht** | `llm/` (ohne `VegetarianHeuristic`-Ersatz auf Serverseite), `pipeline/`, `validate/`, `vault/`, `yaml/`, `validator/` (Node-Projekt), `assets/recipe-vault-frontmatter.schema.json` |

---

### Task 1: Schema und Repository um carbs, fat und section erweitern

**Files:**
- Modify: `web/prisma/schema.prisma` (Model `Recipe`, Model `Ingredient`)
- Modify: `web/src/lib/repositories/recipes.ts` (`RecipeInput`, `RecipeIngredientInput`, `scalarFields`, `ingredientRows`, `upsertImportedRecipe`)
- Modify: `web/src/lib/services/recipeImport.ts` (`ImportedRecipe`, `ImportedIngredient`)
- Modify: `web/src/lib/services/recipeIdeas.ts` (`recipeIdeaToImported` — Compile-Fix)
- Test: `web/src/lib/repositories/recipes.test.ts`

**Interfaces:**
- Produces: `ImportedRecipe` mit zusätzlich `carbs: number | null` und `fat: number | null`; `ImportedIngredient` mit zusätzlich `section?: string | null`. `RecipeInput` mit `carbs?: number | null`, `fat?: number | null`; `RecipeIngredientInput` mit `section?: string | null`. Alle folgenden Tasks bauen auf diesen Formen auf.

- [ ] **Step 1: Schema erweitern**

In `web/prisma/schema.prisma`, Model `Recipe`, direkt unter `protein`:

```prisma
  carbs       Int? // g pro Portion
  fat         Int? // g pro Portion
```

Im Model `Ingredient`, unter `unit`:

```prisma
  section String? // Zutaten-Gruppe der Quelle, z.B. "Für die Soße"; null = keine Gruppe
```

- [ ] **Step 2: Migration erzeugen**

```bash
cd web && npx prisma migrate dev --name recipe_carbs_fat_ingredient_section
```

Erwartung: neuer Ordner unter `web/prisma/migrations/`, `src/generated/` neu gebaut.

- [ ] **Step 3: Den failing test schreiben**

In `web/src/lib/repositories/recipes.test.ts`, innerhalb `describe("recipes repository", ...)`:

```ts
  it("übernimmt carbs, fat und Zutaten-Gruppen beim Import", async () => {
    const imported: ImportedRecipe = {
      slug: "linsen-dal",
      name: "Linsen-Dal",
      rating: "ok",
      simple: true,
      reheatable: true,
      tags: ["vegetarisch"],
      source: null,
      imageUrl: null,
      servings: 4,
      prepMinutes: 10,
      cookMinutes: 25,
      kcal: 420,
      protein: 18,
      carbs: 55,
      fat: 9,
      ingredients: [
        { name: "Rote Linsen", amount: "200", unit: "g", section: null },
        { name: "Skyr", amount: "150", unit: "g", section: "Dip" },
      ],
      steps: ["Linsen waschen.", "25 Minuten köcheln."],
    };

    const { id } = await upsertImportedRecipe(imported);
    const recipe = await getRecipe(id);

    expect(recipe?.carbs).toBe(55);
    expect(recipe?.fat).toBe(9);
    expect(recipe?.ingredients.map((i) => i.section)).toEqual([null, "Dip"]);
  });
```

- [ ] **Step 4: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/repositories/recipes.test.ts -t "carbs"`
Erwartung: FAIL — Typfehler auf `carbs`/`fat`/`section`, bzw. `undefined` statt der Werte.

- [ ] **Step 5: Typen und Mapping nachziehen**

In `web/src/lib/services/recipeImport.ts`:

```ts
export interface ImportedIngredient {
  name: string;
  amount?: string | null;
  unit?: string | null;
  /** Zutaten-Gruppe der Quelle, z.B. "Für die Soße". null = keine Gruppe. */
  section?: string | null;
}
```

und im `ImportedRecipe`-Interface direkt unter `protein: number | null;`:

```ts
  carbs: number | null;
  fat: number | null;
```

In `web/src/lib/repositories/recipes.ts` — `RecipeIngredientInput` um `section?: string | null;` erweitern, `RecipeInput` um `carbs?: number | null;` und `fat?: number | null;` direkt unter `protein`.

In `scalarFields`, unter der `protein`-Zeile:

```ts
    carbs: input.carbs ?? null,
    fat: input.fat ?? null,
```

In `ingredientRows`, im `.map(...)`-Objekt unter `unit`:

```ts
      section: i.section?.trim() || null,
```

In `upsertImportedRecipe`, im `input`-Objekt unter `protein: recipe.protein,`:

```ts
    carbs: recipe.carbs,
    fat: recipe.fat,
```

und im `ingredients`-Mapping desselben Objekts:

```ts
    ingredients: recipe.ingredients.map((i) => ({
      name: i.name,
      amount: i.amount ?? null,
      unit: i.unit ?? null,
      section: i.section ?? null,
    })),
```

- [ ] **Step 6: recipeIdeaToImported compile-fest machen**

In `web/src/lib/services/recipeIdeas.ts`, in `recipeIdeaToImported` unter `protein: null,`:

```ts
    carbs: null,
    fat: null,
```

- [ ] **Step 7: Tests und Typecheck**

Run: `cd web && npx vitest run src/lib/repositories/recipes.test.ts && npm run typecheck`
Erwartung: PASS, keine Typfehler.

- [ ] **Step 8: Commit**

```bash
git add web/prisma web/src/lib/repositories/recipes.ts web/src/lib/services/recipeImport.ts web/src/lib/services/recipeIdeas.ts web/src/lib/repositories/recipes.test.ts
git commit -m "feat(rezepte): carbs, fat und Zutaten-Gruppen im Datenmodell"
```

---

### Task 2: Link-Import liefert carbs und fat mit

**Files:**
- Modify: `web/src/lib/services/recipeImport.ts` (Nährwert-Extraktion)
- Test: `web/src/lib/services/recipeImport.test.ts`

**Interfaces:**
- Consumes: `ImportedRecipe.carbs`/`.fat` aus Task 1.
- Produces: nichts Neues — `importRecipeFromUrl` füllt die beiden Felder jetzt aus dem schema.org-Markup.

- [ ] **Step 1: Den failing test schreiben**

In `web/src/lib/services/recipeImport.test.ts` — die vorhandene `SCHEMA`-Fixture hat einen `nutrition`-Block. Neuer Test daneben:

```ts
  it("liest Kohlenhydrate und Fett aus dem Nährwert-Block", () => {
    const schema = {
      ...SCHEMA,
      nutrition: {
        "@type": "NutritionInformation",
        calories: "420 kcal",
        proteinContent: "18 g",
        carbohydrateContent: "55 g",
        fatContent: "9,5 g",
      },
    };
    const recipe = toImportedRecipe(schema, "https://example.org/rezept");
    expect(recipe.carbs).toBe(55);
    expect(recipe.fat).toBe(10);
  });
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/services/recipeImport.test.ts -t "Kohlenhydrate"`
Erwartung: FAIL — `carbs` ist `null`.

- [ ] **Step 3: Extraktion ergänzen**

In `web/src/lib/services/recipeImport.ts`, in `toImportedRecipe` direkt unter der Zeile `const protein = parseNutritionNumber(nutrition.proteinContent);`:

```ts
  const carbs = parseNutritionNumber(nutrition.carbohydrateContent);
  const fat = parseNutritionNumber(nutrition.fatContent);
```

und im `return`-Objekt derselben Funktion unter `protein,`:

```ts
    carbs,
    fat,
```

`parseNutritionNumber` existiert bereits (Zeile ~328), macht `","` zu `"."` und rundet — `9,5 g` wird damit zu `10`. Keine zweite Parse-Funktion schreiben.

- [ ] **Step 4: Tests**

Run: `cd web && npx vitest run src/lib/services/recipeImport.test.ts`
Erwartung: PASS, auch die bestehenden Nährwert-Tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/recipeImport.ts web/src/lib/services/recipeImport.test.ts
git commit -m "feat(rezepte): Link-Import uebernimmt Kohlenhydrate und Fett"
```

---

### Task 3: Vegetarisch-Heuristik nach TypeScript portieren

**Files:**
- Create: `web/src/lib/services/vegetarianTag.ts`
- Test: `web/src/lib/services/vegetarianTag.test.ts`

**Interfaces:**
- Produces: `isVegetarian(ingredients: { name: string }[]): boolean` und `withVegetarianTag(tags: string[], ingredients: { name: string }[]): string[]`. Task 4 ruft `withVegetarianTag` auf.

**Warum kein LLM:** Die Regel ist deterministisch und in `VegetarianHeuristic.kt` seit Monaten erprobt. Eine feste Wortliste ist testbar und kostet kein Kontingent — das Modell danach zu fragen wäre teurer und wackliger.

- [ ] **Step 1: Den failing test schreiben**

`web/src/lib/services/vegetarianTag.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { isVegetarian, withVegetarianTag } from "./vegetarianTag";

describe("vegetarianTag", () => {
  it("erkennt Fleisch und Fisch", () => {
    expect(isVegetarian([{ name: "Hähnchenbrust" }])).toBe(false);
    expect(isVegetarian([{ name: "Räucherlachs" }])).toBe(false);
    expect(isVegetarian([{ name: "Gelatine" }])).toBe(false);
  });

  it("hält mehrdeutige Wörter für vegetarisch", () => {
    // "hack" in "gehackt", "ham" in "Champignon", "rind" in "Tamarinde"
    expect(isVegetarian([{ name: "gehackte Tomaten" }])).toBe(true);
    expect(isVegetarian([{ name: "Champignons" }])).toBe(true);
    expect(isVegetarian([{ name: "Tamarindenpaste" }])).toBe(true);
  });

  it("setzt den Tag genau einmal und nur wenn vegetarisch", () => {
    expect(withVegetarianTag(["curry"], [{ name: "Linsen" }])).toEqual(["curry", "vegetarisch"]);
    expect(withVegetarianTag(["Vegetarisch"], [{ name: "Linsen" }])).toEqual(["Vegetarisch"]);
    expect(withVegetarianTag(["curry"], [{ name: "Rinderhack" }])).toEqual(["curry"]);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/services/vegetarianTag.test.ts`
Erwartung: FAIL — Modul existiert nicht.

- [ ] **Step 3: Implementieren**

`web/src/lib/services/vegetarianTag.ts` — Wortliste 1:1 aus `Rezept-Importer/android/app/src/main/java/de/dml/rezeptimporter/llm/VegetarianHeuristic.kt`:

```ts
// Grobe Heuristik: Ist das Rezept vegetarisch? Prüft die Zutaten-Namen auf
// Fleisch- und Fischbegriffe. Kein Treffer ⇒ vegetarisch.
//
// Bewusst nur lange, eindeutige Stämme als Substring — kurze, mehrdeutige
// ("hack" in "gehackt", "ham" in "Champignon", "rind" in "Tamarinde") sind
// absichtlich NICHT gelistet, um vegetarische Rezepte nicht falsch zu
// markieren. Portiert aus VegetarianHeuristic.kt (ObsidiDine).

const MEAT_FISH = [
  // Geflügel
  "hähnchen", "hühnchen", "hühner", "huhn", "geflügel", "pute", "puten",
  "truthahn", "ente",
  // Rind / Schwein / sonstiges Fleisch
  "rinder", "rindfleisch", "hackfleisch", "tatar", "tartar", "schwein",
  "speck", "bacon", "schinken", "wurst", "würstchen", "cabanossi", "salami",
  "chorizo", "mettwurst", "leberkäse", "leberwurst", "kalb", "lammfleisch",
  "gulasch", "gyros", "döner", "fleisch", "knochen",
  // Fisch & Meeresfrüchte
  "fisch", "thunfisch", "lachs", "garnele", "scampi", "shrimp", "prawn",
  "krabbe", "hummer", "hering", "sardelle", "sardine", "makrele", "forelle",
  "tintenfisch", "anchovi",
  // Tierische Geliermittel
  "gelatine", "gelantine",
  // Englische Fallbacks
  "chicken", "beef", "pork", "sausage", "salmon", "tuna",
];

export const VEGETARIAN_TAG = "vegetarisch";

export function isVegetarian(ingredients: { name: string }[]): boolean {
  const names = ingredients.map((i) => i.name).join(" ").toLowerCase();
  return !MEAT_FISH.some((term) => names.includes(term));
}

/** Hängt `vegetarisch` an, wenn es passt und noch nicht (in beliebiger Schreibweise) drinsteht. */
export function withVegetarianTag(
  tags: string[],
  ingredients: { name: string }[],
): string[] {
  if (!isVegetarian(ingredients)) return tags;
  if (tags.some((t) => t.toLowerCase() === VEGETARIAN_TAG)) return tags;
  return [...tags, VEGETARIAN_TAG];
}
```

- [ ] **Step 4: Tests**

Run: `cd web && npx vitest run src/lib/services/vegetarianTag.test.ts`
Erwartung: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/vegetarianTag.ts web/src/lib/services/vegetarianTag.test.ts
git commit -m "feat(rezepte): Vegetarisch-Heuristik als Tag-Regel auf Serverseite"
```

---

### Task 4: claude-CLI-Wrapper herausziehen und Fehler sichtbar machen

**Files:**
- Create: `web/src/lib/services/claudeCli.ts`
- Modify: `web/src/lib/services/recipeIdeas.ts` (eigenes `runClaude` löschen, importieren)
- Test: `web/src/lib/services/claudeCli.test.ts`

**Interfaces:**
- Produces: `runClaude(prompt: string, opts?: { timeoutMs?: number; model?: string }): Promise<string>` und `parseClaudeResult(stdout: string): string`. Task 5 nutzt `runClaude`.

**Warum:** `recipeIdeas.ts` hat den Wrapper privat. Der zweite Aufrufer kommt in Task 5 — statt zu kopieren einmal herausziehen. Gleichzeitig wird der Fehler behoben, der uns am 2026-08-26 gekostet hat: Bei abgelaufenem Token liefert die CLI **Exit-Code 0** mit `"is_error": true` im JSON. Der alte Wrapper hat das als Erfolg gewertet und einen leeren String zurückgegeben.

- [ ] **Step 1: Den failing test schreiben**

`web/src/lib/services/claudeCli.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import { parseClaudeResult } from "./claudeCli";

describe("parseClaudeResult", () => {
  it("gibt das Ergebnisfeld zurück", () => {
    const stdout = JSON.stringify({ type: "result", is_error: false, result: "Hallo" });
    expect(parseClaudeResult(stdout)).toBe("Hallo");
  });

  it("wirft bei is_error mit der Meldung der CLI", () => {
    const stdout = JSON.stringify({
      type: "result",
      is_error: true,
      api_error_status: 401,
      result: "OAuth access token has expired. Re-authenticate to continue.",
    });
    expect(() => parseClaudeResult(stdout)).toThrow(/401/);
    expect(() => parseClaudeResult(stdout)).toThrow(/expired/);
  });

  it("wirft bei unlesbarer Ausgabe", () => {
    expect(() => parseClaudeResult("kein json")).toThrow(/Ausgabeformat/);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/services/claudeCli.test.ts`
Erwartung: FAIL — Modul existiert nicht.

- [ ] **Step 3: Wrapper implementieren**

`web/src/lib/services/claudeCli.ts`:

```ts
// Gemeinsamer Wrapper um die `claude` CLI im Headless-Modus. Authentifiziert
// über CLAUDE_CODE_OAUTH_TOKEN aus web/.env gegen das Claude-Abo — kein
// API-Key, keine Kosten pro Aufruf.
//
// Der Prompt geht via **stdin** rein (nicht argv) — vermeidet Quoting-Probleme
// mit mehrzeiligen Prompts plattformübergreifend. Nur Flags stehen in argv,
// daher ist `shell:true` (Windows: `claude.cmd` auflösen) hier ungefährlich.
//
// NIEMALS `--bare` ergänzen: in diesem Modus liest die CLI bewusst keine
// OAuth-Credentials, nur ANTHROPIC_API_KEY — der Abo-Weg wäre tot.

import { spawn } from "node:child_process";
import { tmpdir } from "node:os";

export const DEFAULT_MODEL = "claude-sonnet-5";

export interface RunClaudeOptions {
  timeoutMs?: number;
  model?: string;
}

/**
 * Liest das `result`-Feld aus der `--output-format json`-Ausgabe.
 *
 * Wichtig: die CLI beendet sich mit Exit-Code 0, auch wenn der Aufruf
 * inhaltlich gescheitert ist (abgelaufener Token, Rate-Limit) — erkennbar nur
 * an `is_error`. Ohne diese Prüfung kommt ein leerer String durch und der
 * Fehler taucht erst drei Schichten später als "kein Rezept erkannt" auf.
 */
export function parseClaudeResult(stdout: string): string {
  let payload: { is_error?: boolean; api_error_status?: number | null; result?: unknown };
  try {
    payload = JSON.parse(stdout);
  } catch {
    throw new Error("claude CLI: unerwartetes Ausgabeformat");
  }
  const text = String(payload.result ?? "");
  if (payload.is_error) {
    const status = payload.api_error_status ? ` (HTTP ${payload.api_error_status})` : "";
    throw new Error(`claude CLI${status}: ${text || "unbekannter Fehler"}`);
  }
  return text;
}

/** Ruft die CLI headless auf. Wirft bei Timeout, Prozessfehler oder `is_error`. */
export function runClaude(prompt: string, opts: RunClaudeOptions = {}): Promise<string> {
  const { timeoutMs = 120_000, model = DEFAULT_MODEL } = opts;
  return new Promise((resolve, reject) => {
    const child = spawn(
      "claude",
      ["-p", "--output-format", "json", "--model", model],
      { cwd: tmpdir(), shell: process.platform === "win32" }, // tmp-cwd: kein Repo-Context
    );
    let out = "";
    let err = "";
    const timer = setTimeout(() => {
      child.kill();
      reject(new Error(`claude CLI Timeout nach ${Math.round(timeoutMs / 1000)}s`));
    }, timeoutMs);
    child.stdin.on("error", () => {}); // EPIPE schlucken, falls Kind früh stirbt
    child.stdin.write(prompt);
    child.stdin.end();
    child.stdout.on("data", (d) => (out += d));
    child.stderr.on("data", (d) => (err += d));
    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      if (code !== 0) return reject(new Error(`claude CLI exit ${code}: ${err.slice(0, 500)}`));
      try {
        resolve(parseClaudeResult(out));
      } catch (e) {
        reject(e);
      }
    });
  });
}
```

- [ ] **Step 4: recipeIdeas auf den Wrapper umstellen**

In `web/src/lib/services/recipeIdeas.ts`: die komplette lokale `runClaude`-Funktion samt der Imports `spawn` und `tmpdir` löschen, stattdessen oben:

```ts
import { runClaude } from "@/lib/services/claudeCli";
```

Der Aufruf in `generateRecipeIdeas` bleibt `await runClaude(buildIdeasPrompt(existingNames, opts))` — die Signatur ist absichtlich kompatibel.

- [ ] **Step 5: Tests und Typecheck**

Run: `cd web && npx vitest run src/lib/services/claudeCli.test.ts src/lib/services/recipeIdeas.test.ts && npm run typecheck`
Erwartung: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/claudeCli.ts web/src/lib/services/claudeCli.test.ts web/src/lib/services/recipeIdeas.ts
git commit -m "refactor(rezepte): claude-CLI-Wrapper geteilt, Fehler nicht mehr verschluckt"
```

---

### Task 5: Extraktions-Service

**Files:**
- Create: `web/src/lib/services/recipeExtract.ts`
- Test: `web/src/lib/services/recipeExtract.test.ts`

**Interfaces:**
- Consumes: `runClaude` (Task 4), `withVegetarianTag` (Task 3), `ImportedRecipe`/`ImportedIngredient`/`slugFromName` (Task 1 bzw. Bestand).
- Produces:
  - `EXTRACTION_PROMPT: string`
  - `buildExtractionPrompt(rawText: string, repairHint?: string | null): string`
  - `parseExtractionResponse(raw: string): ExtractedRecipe | null`
  - `toImportedFromExtraction(e: ExtractedRecipe, sourceUrl: string | null): ImportedRecipe`
  - `problemsOf(recipe: ImportedRecipe): string[]`
  - `extractRecipeFromText(rawText: string, sourceUrl?: string | null): Promise<ImportedRecipe>`
  - `interface ExtractedRecipe` mit `name`, `tags`, `servings`, `prepMinutes`, `cookMinutes`, `ingredients` (`name`, `amount`, `unit`, `section`), `steps`, `nutrition` (`basis`, `kcal`, `protein`, `carbs`, `fat`)

  Task 6 ruft `extractRecipeFromText`.

**Der Prompt wird nicht neu erfunden.** `ExtractionPrompt.INSTRUCTION` in `Rezept-Importer/android/app/src/main/java/de/dml/rezeptimporter/llm/ExtractionPrompt.kt` ist über Monate an echten HelloFresh-Karten und Instagram-Captions getunt (Spaltenraster, Zutaten-Gruppen, metrische Umrechnung, Portionsspalten). Diese Regeln wörtlich übernehmen, nur die drei Ergänzungen unten anhängen.

- [ ] **Step 1: Den failing test schreiben**

`web/src/lib/services/recipeExtract.test.ts`:

```ts
import { describe, expect, it } from "vitest";

import {
  buildExtractionPrompt,
  parseExtractionResponse,
  problemsOf,
  toImportedFromExtraction,
} from "./recipeExtract";

const EXTRACTED = {
  name: "Linsen-Dal",
  tags: ["indisch"],
  servings: 4,
  prepMinutes: 10,
  cookMinutes: 25,
  ingredients: [
    { name: "Rote Linsen", amount: "200", unit: "g", section: null },
    { name: "Skyr", amount: "150", unit: "g", section: "Dip" },
  ],
  steps: ["Linsen waschen.", "25 Minuten köcheln."],
  nutrition: { basis: "pro Portion", kcal: 420, protein: 18, carbs: 55, fat: 9.4 },
};

describe("parseExtractionResponse", () => {
  it("liest JSON auch mit Prosa und Code-Fence drumherum", () => {
    const raw = "Hier das Rezept:\n```json\n" + JSON.stringify(EXTRACTED) + "\n```\nViel Spaß!";
    expect(parseExtractionResponse(raw)?.name).toBe("Linsen-Dal");
  });

  it("gibt null bei unlesbarer Antwort", () => {
    expect(parseExtractionResponse("Tut mir leid, kein Rezept gefunden.")).toBeNull();
  });
});

describe("toImportedFromExtraction", () => {
  it("mappt auf ImportedRecipe inklusive Nährwerten und Gruppen", () => {
    const r = toImportedFromExtraction(EXTRACTED, "https://example.org/dal");
    expect(r.slug).toBe("linsen-dal");
    expect(r.source).toBe("https://example.org/dal");
    expect(r.kcal).toBe(420);
    expect(r.carbs).toBe(55);
    expect(r.fat).toBe(9); // gerundet, wie protein
    expect(r.ingredients[1].section).toBe("Dip");
    expect(r.rating).toBe("ok");
    expect(r.reheatable).toBe(false);
  });

  it("hängt den Tag vegetarisch an, wenn kein Fleisch drin ist", () => {
    expect(toImportedFromExtraction(EXTRACTED, null).tags).toEqual(["indisch", "vegetarisch"]);
  });

  it("verwirft Nährwerte, deren Bezug nicht die Portion ist", () => {
    const per100g = { ...EXTRACTED, nutrition: { ...EXTRACTED.nutrition, basis: "pro 100g" } };
    const r = toImportedFromExtraction(per100g, null);
    expect(r.kcal).toBeNull();
    expect(r.carbs).toBeNull();
    expect(r.fat).toBeNull();
    expect(r.protein).toBeNull();
  });
});

describe("problemsOf", () => {
  it("meldet leeren Namen, fehlende Zutaten und fehlende Schritte", () => {
    const empty = toImportedFromExtraction(
      { ...EXTRACTED, name: "   ", ingredients: [], steps: [] },
      null,
    );
    const problems = problemsOf(empty);
    expect(problems).toHaveLength(3);
    expect(problems.join(" ")).toMatch(/Name/);
  });

  it("ist still bei einem sauberen Rezept", () => {
    expect(problemsOf(toImportedFromExtraction(EXTRACTED, null))).toEqual([]);
  });
});

describe("buildExtractionPrompt", () => {
  it("kappt sehr langen Text und hängt den Repair-Hinweis an", () => {
    const prompt = buildExtractionPrompt("x".repeat(20_000), "Name fehlt");
    expect(prompt.length).toBeLessThan(20_000);
    expect(prompt).toContain("Name fehlt");
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/services/recipeExtract.test.ts`
Erwartung: FAIL — Modul existiert nicht.

- [ ] **Step 3: Service implementieren**

`web/src/lib/services/recipeExtract.ts`. Gerüst — `EXTRACTION_PROMPT` mit den Regeln aus `ExtractionPrompt.kt` füllen:

```ts
// Rezept-Extraktion aus Rohtext (OCR von Rezeptkarten, Social-Media-Captions)
// via `claude -p` über das Abo. Web-Links laufen NICHT hier durch — die löst
// `recipeImport.ts` ohne LLM aus dem schema.org-Markup.
//
// Die Regeln im Prompt sind aus ObsidiDine übernommen (ExtractionPrompt.kt)
// und an echten HelloFresh-Karten und Instagram-Captions getunt. Nicht
// umformulieren, ohne an denselben Quellen gegenzuprüfen.

import { runClaude } from "@/lib/services/claudeCli";
import { withVegetarianTag } from "@/lib/services/vegetarianTag";
import { slugFromName, type ImportedRecipe } from "@/lib/services/recipeImport";

export const MAX_INPUT_CHARS = 6000;

export interface ExtractedIngredient {
  name: string;
  amount?: string | null;
  unit?: string | null;
  section?: string | null;
}

export interface ExtractedNutrition {
  basis?: string | null;
  kcal?: number | null;
  protein?: number | null;
  carbs?: number | null;
  fat?: number | null;
}

export interface ExtractedRecipe {
  name: string;
  tags?: string[];
  servings?: number | null;
  prepMinutes?: number | null;
  cookMinutes?: number | null;
  ingredients: ExtractedIngredient[];
  steps: string[];
  nutrition?: ExtractedNutrition | null;
}

export const EXTRACTION_PROMPT = `
Du extrahierst Kochrezepte aus rohem Text (OCR-Ergebnisse, Social-Media-Captions).
Antworte mit NICHTS außer einem JSON-Objekt. Sprache: Deutsch.
Regeln:
- ÜBERSETZEN: Ist das Rezept nicht auf Deutsch (z.B. Englisch), übersetze ALLES
  ins Deutsche — "name", Zutaten-Namen inkl. "section", "steps", "tags",
  "nutrition.basis".
  Nichts in der Ausgabe darf in einer anderen Sprache bleiben.
- METRISCH UMRECHNEN: Wandle US-/imperiale Mengen in europäische metrische Einheiten um.
  Runde auf küchentaugliche Werte. Umrechnungen:
    • lb/lbs/pound → g (1 lb ≈ 454 g), oz/ounce (Gewicht) → g (1 oz ≈ 28 g)
    • fl oz → ml (1 fl oz ≈ 30 ml), cup → ml bei Flüssigem (1 cup ≈ 240 ml)
    • stick Butter → g (1 stick ≈ 113 g)
    • tsp/teaspoon → TL, tbsp/Tbsp/tablespoon → EL
    • °F → °C (auch in "steps"!): °C = (°F − 32) × 5/9, auf 5er gerundet (z.B. 400°F → 200°C)
    • inch → cm (1 inch ≈ 2,5 cm)
  "to taste" → weglassen (kein amount), "a little"/"a pinch" → unit "Prise" ohne amount.
- "amount" immer als String: ganze Zahlen "400", Dezimal "1.5", Brüche "1/2", Bereiche "2-3".
- "unit" separat: g, kg, ml, l, EL, TL, Stk, Prise, Bund.
- ZUTATEN-GRUPPEN: Jede Zeile in der Zutatenliste, die KEINE Zutat mit Menge ist, sondern
  einen Teil des Gerichts benennt, ist eine Gruppenüberschrift — mit ODER ohne
  Doppelpunkt, ein einzelnes Wort genügt. Beispiele: "Für die Nuggets:", "Für die Soße:",
  "Dip", "Sauce", "Teig", "Topping", "Marinade", "Füllung", "Zum Servieren".
  Setze bei JEDER Zutat unterhalb einer solchen Zeile "section" auf diese Überschrift
  (ohne Doppelpunkt, Schreibweise der Quelle). Die Überschrift selbst NIEMALS als Zutat
  ausgeben. Zutaten oberhalb der ersten Überschrift bleiben ohne "section".
  Beispiel:
    "300g Hähnchenbrust"  ⇒ {"name":"Hähnchenbrust","amount":"300","unit":"g"}
    "Dip"                 ⇒ Überschrift, KEINE Zutat
    "150g Skyr"           ⇒ {"name":"Skyr","amount":"150","unit":"g","section":"Dip"}
  Keine Gruppen sind Zeilen wie "Zutaten", "Zutaten für 2 Personen", "Rezept",
  "Zubereitung". Reihenfolge der Zutaten nicht verändern. Fehlen solche Zeilen,
  "section" überall weglassen — keine Gruppen erfinden.
- PORTIONEN: Enthält der Text Zutatenmengen für mehrere Personenzahlen (z.B. Spalten "2P",
  "3P", "4P" oder "2 Personen / 4 Personen"), verwende ausschließlich die Mengen der
  kleinsten angegebenen Portion (z.B. 2P) und setze "servings" auf diese Zahl.
  Nimm niemals Mengen aus verschiedenen Portionsspalten.
- "steps": Bei mehrspaltig gescannten Rezeptkarten (z.B. HelloFresh 3×2-Raster) liefert
  der OCR-Text die Schritte spaltenweise gruppiert: erst alle Schritte der linken Spalte
  (z.B. Schritt 1 und 4), dann der mittleren (2 und 5), dann der rechten (3 und 6).
  Erkenne jeden Schritt am Titel (kurze Imperativphrase, z.B. „Kartoffeln vorbereiten").
  Der zugehörige Beschreibungstext folgt direkt darunter bis zum nächsten Titel.
  Bringe die Schritte in die logisch richtige Kochreihenfolge; sind Schrittnummern im Text
  vorhanden, nutze sie zur Sortierung. Schrittnummern nicht in den Ausgabetext übernehmen.
  Jeden Schritt als vollständige Sätze ausgeben.
- "nutrition" nur befüllen, wenn Nährwerte im Text explizit genannt sind: kcal (Energie),
  protein/carbs/fat in Gramm (nur Zahl, ohne Einheit). Nährwerte niemals schätzen oder
  berechnen.
- "nutrition.basis" wörtlich übernehmen, wie es im Text steht ("pro Portion",
  "pro 100g"). Niemals raten und niemals umrechnen.
- Unbekannte Felder weglassen bzw. auf null setzen. Nichts erfinden.

Format:
{ "name": string, "tags": string[], "servings": number|null,
  "prepMinutes": number|null, "cookMinutes": number|null,
  "ingredients": [{ "name": string, "amount": string|null, "unit": string|null,
                    "section": string|null }],
  "steps": string[],
  "nutrition": { "basis": string|null, "kcal": number|null, "protein": number|null,
                 "carbs": number|null, "fat": number|null } | null }

Prüfe vor dem Antworten selbst: Steht jede ausgegebene Zutat wörtlich im
Quelltext? Ist jede Menge übernommen und keine erfunden? Ist alles auf Deutsch
und metrisch? Korrigiere still, bevor du antwortest.
`.trim();

export function buildExtractionPrompt(rawText: string, repairHint?: string | null): string {
  const capped = rawText.slice(0, MAX_INPUT_CHARS);
  const repair = repairHint
    ? `\n\nDein letzter Versuch war ungültig. Fehler: ${repairHint}\nKorrigiere genau diese Punkte.`
    : "";
  return `${EXTRACTION_PROMPT}\n\nExtrahiere das Rezept aus folgendem Text:\n\n${capped}${repair}`;
}

/** Erstes JSON-Objekt aus der (evtl. mit Prosa/Fences garnierten) Antwort. */
export function parseExtractionResponse(raw: string): ExtractedRecipe | null {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== "object") return null;
  const e = parsed as Record<string, unknown>;
  if (typeof e.name !== "string") return null;
  return {
    name: e.name,
    tags: Array.isArray(e.tags) ? e.tags.map(String) : [],
    servings: numberOrNull(e.servings),
    prepMinutes: numberOrNull(e.prepMinutes),
    cookMinutes: numberOrNull(e.cookMinutes),
    ingredients: Array.isArray(e.ingredients)
      ? e.ingredients.map(coerceIngredient).filter((i): i is ExtractedIngredient => i !== null)
      : [],
    steps: Array.isArray(e.steps) ? e.steps.map(String).filter((s) => s.trim() !== "") : [],
    nutrition: coerceNutrition(e.nutrition),
  };
}
```

Die Hilfsfunktionen dazu — dieselbe defensive Machart wie die `coerce*`-Funktionen in `recipeIdeas.ts`, damit ein halb kaputtes JSON nicht die Route sprengt:

```ts
function numberOrNull(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const n = Number(value.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

/** Nährwerte landen als ganze Gramm bzw. kcal in der DB — wie `protein` seit jeher. */
function roundOrNull(value: number | null | undefined): number | null {
  return value == null ? null : Math.round(value);
}

function textOrNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" ? null : trimmed;
}

function coerceIngredient(raw: unknown): ExtractedIngredient | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const name = typeof e.name === "string" ? e.name.trim() : "";
  if (name === "") return null;
  return {
    name,
    amount: e.amount == null ? null : String(e.amount),
    unit: textOrNull(e.unit),
    section: textOrNull(e.section),
  };
}

function coerceNutrition(raw: unknown): ExtractedNutrition | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  const nutrition: ExtractedNutrition = {
    basis: textOrNull(e.basis),
    kcal: numberOrNull(e.kcal),
    protein: numberOrNull(e.protein),
    carbs: numberOrNull(e.carbs),
    fat: numberOrNull(e.fat),
  };
  const empty =
    nutrition.kcal === null &&
    nutrition.protein === null &&
    nutrition.carbs === null &&
    nutrition.fat === null;
  return empty ? null : nutrition;
}
```

Nährwert-Basis und Mapping:

```ts
/** Nur "pro Portion" zählt. Die DB hat kein Basis-Feld; 100g-Werte wären dort schlicht falsch. */
function isPerServing(basis: string | null | undefined): boolean {
  if (!basis) return true; // keine Angabe: die Quelle meint fast immer die Portion
  const b = basis.toLowerCase();
  if (/100\s*(g|ml)/.test(b)) return false;
  return /portion|serving|stück|person/.test(b) || b.trim() === "";
}

export function toImportedFromExtraction(
  e: ExtractedRecipe,
  sourceUrl: string | null,
): ImportedRecipe {
  const ingredients = e.ingredients.map((i) => ({
    name: i.name,
    amount: i.amount ?? null,
    unit: i.unit ?? null,
    section: i.section ?? null,
  }));
  const n = isPerServing(e.nutrition?.basis) ? e.nutrition : null;
  return {
    slug: slugFromName(e.name),
    name: e.name,
    rating: "ok",          // Haushaltsentscheidung, nicht Sache der Quelle
    simple: true,
    reheatable: false,
    tags: withVegetarianTag(e.tags ?? [], ingredients),
    source: sourceUrl,
    imageUrl: null,        // aus Rohtext kommt kein Bild
    servings: e.servings ?? null,
    prepMinutes: e.prepMinutes ?? null,
    cookMinutes: e.cookMinutes ?? null,
    kcal: roundOrNull(n?.kcal),
    protein: roundOrNull(n?.protein),
    carbs: roundOrNull(n?.carbs),
    fat: roundOrNull(n?.fat),
    ingredients,
    steps: e.steps,
  };
}

/** Was ein Rezept haben muss, um überhaupt speicherbar zu sein. */
export function problemsOf(recipe: ImportedRecipe): string[] {
  const problems: string[] = [];
  if (recipe.name.trim() === "" || recipe.slug === "") {
    problems.push(`Name "${recipe.name}" ergibt keinen gültigen Slug`);
  }
  if (recipe.ingredients.length === 0) problems.push("Keine Zutaten erkannt");
  if (recipe.steps.length === 0) problems.push("Keine Zubereitungsschritte erkannt");
  return problems;
}
```

Und der Aufruf mit genau einem Repair-Retry — dieselbe Logik wie `ImportPipeline.extractCore` in ObsidiDine:

```ts
/**
 * Rohtext → validiertes `ImportedRecipe`. Höchstens zwei CLI-Aufrufe:
 * die Extraktion und ein Repair-Retry mit den konkreten Mängeln als Hinweis.
 */
export async function extractRecipeFromText(
  rawText: string,
  sourceUrl: string | null = null,
): Promise<ImportedRecipe> {
  if (rawText.trim() === "") throw new Error("Kein Text zum Auswerten übergeben.");

  const first = parseExtractionResponse(await runClaude(buildExtractionPrompt(rawText)));
  const firstProblems = first
    ? problemsOf(toImportedFromExtraction(first, sourceUrl))
    : ["Antwort enthielt kein lesbares JSON"];
  if (first && firstProblems.length === 0) return toImportedFromExtraction(first, sourceUrl);

  const second = parseExtractionResponse(
    await runClaude(buildExtractionPrompt(rawText, firstProblems.join("; "))),
  );
  if (!second) throw new Error("Aus dem Text ließ sich kein Rezept lesen.");
  const recipe = toImportedFromExtraction(second, sourceUrl);
  const problems = problemsOf(recipe);
  if (problems.length > 0) {
    throw new Error(`Extraktion bleibt unvollständig: ${problems.join("; ")}`);
  }
  return recipe;
}
```

- [ ] **Step 4: Tests und Typecheck**

Run: `cd web && npx vitest run src/lib/services/recipeExtract.test.ts && npm run typecheck`
Erwartung: PASS.

- [ ] **Step 5: Gegen echten Text prüfen**

Auf dem Tablet (dort liegt der Token) eine Instagram-Caption oder abgetippte Rezeptkarte durchschicken:

```bash
ssh -p 8022 u0_a353@192.168.178.91
cd ~/haushalts-dashboard/web
npx tsx -e "import('./src/lib/services/recipeExtract.ts').then(async m => console.log(JSON.stringify(await m.extractRecipeFromText(require('fs').readFileSync('/sdcard/Download/probe.txt','utf8')), null, 2)))"
```

Erwartung: JSON mit deutschen Zutaten, metrischen Mengen, gefüllten `section`-Feldern bei gruppierten Rezepten. Passt etwas systematisch nicht, ist der Prompt zu korrigieren — nicht das Mapping.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/recipeExtract.ts web/src/lib/services/recipeExtract.test.ts
git commit -m "feat(rezepte): Extraktion aus Rohtext ueber das Claude-Abo"
```

---

### Task 6: API-Routen mit Token-Schutz

**Files:**
- Create: `web/src/lib/api/importAuth.ts`
- Create: `web/src/app/api/recipes/parse/route.ts`
- Create: `web/src/app/api/recipes/import/route.ts`
- Modify: `web/.env.example`
- Test: `web/src/lib/api/importAuth.test.ts`

**Interfaces:**
- Consumes: `extractRecipeFromText` (Task 5), `importRecipeFromUrl` (Bestand), `upsertImportedRecipe` + `attachRecipeImage` (Bestand), `ImportedRecipe` (Task 1).
- Produces: HTTP-Kontrakt, den Task 7 im Android-Client implementiert:
  - `POST /api/recipes/parse` — Body `{ "text": string, "sourceUrl"?: string|null }` → `200 { "ok": true, "recipe": ImportedRecipe }` | `4xx/5xx { "ok": false, "error": string }`
  - `POST /api/recipes/import` — Body `{ "recipe": ImportedRecipe }` → `200 { "ok": true, "id": string, "name": string, "updated": boolean }` | `4xx/5xx { "ok": false, "error": string }`
  - Beide erwarten `Authorization: Bearer <RECIPE_IMPORT_TOKEN>`.

**Sicherheit:** Der Hostname liegt hinter Cloudflare Access (am 2026-08-26 gegengeprüft: 302 auf `cloudflareaccess.com`). Die App passiert Access über ein **Service-Token** (Header `CF-Access-Client-Id` / `CF-Access-Client-Secret`) — dafür ist im Code nichts zu tun. Der Bearer-Token in der Route ist der zweite Riegel: Diese Endpunkte geben Abo-Kontingent aus und schreiben in die DB; sie dürfen nicht allein von einer korrekt gesetzten Cloudflare-Regel abhängen. Fehlt `RECIPE_IMPORT_TOKEN` in der Umgebung, antworten beide Routen mit 503 statt ungeschützt zu laufen.

- [ ] **Step 1: Den failing test schreiben**

`web/src/lib/api/importAuth.test.ts`:

```ts
import { afterEach, describe, expect, it } from "vitest";

import { checkImportToken } from "./importAuth";

const req = (auth?: string) =>
  new Request("http://localhost/api/recipes/parse", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });

afterEach(() => {
  delete process.env.RECIPE_IMPORT_TOKEN;
});

describe("checkImportToken", () => {
  it("lehnt ab, solange kein Token konfiguriert ist", () => {
    expect(checkImportToken(req("Bearer egal"))).toEqual({
      ok: false,
      status: 503,
      error: "Import-Endpunkt nicht konfiguriert (RECIPE_IMPORT_TOKEN fehlt).",
    });
  });

  it("lässt den passenden Token durch", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("Bearer geheim"))).toEqual({ ok: true });
  });

  it("lehnt falschen, fehlenden und formlosen Token ab", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("Bearer falsch")).ok).toBe(false);
    expect(checkImportToken(req()).ok).toBe(false);
    expect(checkImportToken(req("geheim")).ok).toBe(false);
    expect(checkImportToken(req("Bearer falsch")).status).toBe(401);
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/api/importAuth.test.ts`
Erwartung: FAIL — Modul existiert nicht.

- [ ] **Step 3: Auth-Helfer implementieren**

`web/src/lib/api/importAuth.ts`:

```ts
// Bearer-Prüfung für die Import-Endpunkte. Zweiter Riegel hinter Cloudflare
// Access: Diese Routen geben Abo-Kontingent aus und schreiben in die DB —
// sie hängen bewusst nicht allein an einer Cloudflare-Regel.

import { timingSafeEqual } from "node:crypto";

export type ImportAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkImportToken(request: Request): ImportAuthResult {
  const expected = process.env.RECIPE_IMPORT_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "Import-Endpunkt nicht konfiguriert (RECIPE_IMPORT_TOKEN fehlt).",
    };
  }
  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || !sameToken(token, expected)) {
    return { ok: false, status: 401, error: "Nicht autorisiert." };
  }
  return { ok: true };
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `cd web && npx vitest run src/lib/api/importAuth.test.ts`
Erwartung: PASS.

- [ ] **Step 5: parse-Route schreiben**

`web/src/app/api/recipes/parse/route.ts`:

```ts
// POST /api/recipes/parse — Rohtext (OCR, Social-Caption) oder Rezept-Link zu
// einem ImportedRecipe machen. Schreibt NICHTS in die DB: ObsidiDine zeigt das
// Ergebnis erst im Editor, gespeichert wird über /api/recipes/import.
//
// Ein Link mit schema.org-Markup läuft ohne LLM durch (recipeImport.ts) — das
// ist schneller, genauer und kostet kein Abo-Kontingent. Erst wenn das nicht
// greift, übernimmt die Extraktion.

import { NextResponse } from "next/server";

import { checkImportToken } from "@/lib/api/importAuth";
import { extractRecipeFromText } from "@/lib/services/recipeExtract";
import { importRecipeFromUrl } from "@/lib/services/recipeImport";

export async function POST(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { text?: unknown; sourceUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  const text = typeof body.text === "string" ? body.text : "";
  const sourceUrl = typeof body.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : null;
  if (text.trim() === "" && !sourceUrl) {
    return NextResponse.json(
      { ok: false, error: "Weder Text noch Quell-URL übergeben." },
      { status: 400 },
    );
  }

  try {
    // Reiner Link ohne Text: erst der günstige Weg über das Seiten-Markup.
    if (sourceUrl && text.trim() === "") {
      try {
        return NextResponse.json({ ok: true, recipe: await importRecipeFromUrl(sourceUrl) });
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Die Seite liefert keine Rezeptdaten. Teile stattdessen den Text oder einen Screenshot.",
          },
          { status: 422 },
        );
      }
    }
    return NextResponse.json({ ok: true, recipe: await extractRecipeFromText(text, sourceUrl) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Extraktion fehlgeschlagen." },
      { status: 502 },
    );
  }
}
```

- [ ] **Step 6: import-Route schreiben**

`web/src/app/api/recipes/import/route.ts`:

```ts
// POST /api/recipes/import — ein (ggf. im Client editiertes) ImportedRecipe in
// die DB schreiben. Derselbe Weg wie Link-Import und Claude-Rezeptideen:
// upsertImportedRecipe dedupliziert über Quell-URL bzw. Slug und lässt
// Bewertung, Notizen und Bild eines bestehenden Rezepts unangetastet.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { checkImportToken } from "@/lib/api/importAuth";
import { revalidateDashboard } from "@/lib/revalidate";
import { upsertImportedRecipe } from "@/lib/repositories/recipes";
import { attachRecipeImage } from "@/lib/services/recipeImage";
import { slugFromName, type ImportedRecipe } from "@/lib/services/recipeImport";

export async function POST(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { recipe?: ImportedRecipe };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  const recipe = body.recipe;
  if (!recipe || typeof recipe.name !== "string" || recipe.name.trim() === "") {
    return NextResponse.json({ ok: false, error: "Rezept ohne Namen." }, { status: 400 });
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return NextResponse.json({ ok: false, error: "Rezept ohne Zutaten." }, { status: 400 });
  }

  try {
    // Der Client darf den Slug leer lassen — bei einem frisch abfotografierten
    // Rezept gibt es keine Vorgeschichte, aus der er stammen könnte.
    const slug = recipe.slug?.trim() || slugFromName(recipe.name);
    const { id, name, updated } = await upsertImportedRecipe({ ...recipe, slug });
    await attachRecipeImage(id, recipe.imageUrl ?? null);
    revalidateDashboard();
    revalidatePath("/mobile/meals/rezepte/[id]", "page");
    return NextResponse.json({ ok: true, id, name, updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
```

- [ ] **Step 7: .env.example ergänzen**

Ans Ende von `web/.env.example`:

```bash
# Token, mit dem ObsidiDine die Rezept-Import-Endpunkte anspricht
# (Authorization: Bearer <wert>). Ohne diese Variable antworten
# /api/recipes/parse und /api/recipes/import mit 503 statt ungeschützt zu
# laufen. Erzeugen z.B. mit: openssl rand -hex 32
RECIPE_IMPORT_TOKEN=

# Langlebiger Abo-Token der claude CLI, erzeugt mit `claude setup-token`.
# Nur damit läuft die Rezept-Extraktion ueber das Abo statt ueber einen
# API-Key. Niemals `--bare` verwenden: dieser Modus liest OAuth bewusst nicht.
CLAUDE_CODE_OAUTH_TOKEN=
```

- [ ] **Step 8: Routen lokal gegen curl prüfen**

```bash
cd web && RECIPE_IMPORT_TOKEN=probe npm run dev
```

In einer zweiten Shell:

```bash
curl -s -X POST localhost:3001/api/recipes/parse -H 'content-type: application/json' -d '{"text":"egal"}'
curl -s -X POST localhost:3001/api/recipes/parse -H 'authorization: Bearer probe' -H 'content-type: application/json' -d '{"text":""}'
```

Erwartung: erster Aufruf `401` mit `{"ok":false,"error":"Nicht autorisiert."}`, zweiter `400` mit der Meldung zu fehlendem Text.

- [ ] **Step 9: Tests, Lint, Typecheck**

Run: `cd web && npm test && npm run lint && npm run typecheck`
Erwartung: PASS.

- [ ] **Step 10: Commit**

```bash
git add web/src/lib/api web/src/app/api/recipes web/.env.example
git commit -m "feat(rezepte): Import-Endpunkte fuer ObsidiDine mit Token-Schutz"
```

---

### Task 7: ObsidiDine auf das Dashboard umstellen

**Files:**
- Create: `android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/domain/RecipeDraft.kt` (`slug`, `sourceUrl`)
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/settings/AppSettings.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/PreviewScreen.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/MainActivity.kt`
- Test: `android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt`

**Interfaces:**
- Consumes: den HTTP-Kontrakt aus Task 6.
- Produces: `DashboardClient(baseUrl, token, cfClientId, cfClientSecret, client: OkHttpClient)` mit `suspend fun parse(text: String, sourceUrl: String?): RecipeDraft` und `suspend fun save(draft: RecipeDraft): SaveResult(val id: String, val name: String, val updated: Boolean)`.

**Anmerkung zum Repo:** Dieser Task läuft im Repo `Rezept-Importer`, nicht im Dashboard. Die APK baut der Workflow `.github/workflows/build-apk.yml` bei jedem Push auf `main` oder `claude/**` und hängt sie an ein Prerelease — nicht lokal bauen wollen, das Android-SDK ist hier nicht eingerichtet.

- [ ] **Step 1: Den failing test schreiben**

`android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt` — Muster von `GeminiExtractorTest.kt` übernehmen (MockWebServer ist bereits Testabhängigkeit):

```kotlin
package de.dml.rezeptimporter.dashboard

import kotlinx.coroutines.runBlocking
import okhttp3.OkHttpClient
import okhttp3.mockwebserver.MockResponse
import okhttp3.mockwebserver.MockWebServer
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DashboardClientTest {

    private fun client(server: MockWebServer) = DashboardClient(
        baseUrl = server.url("/").toString().trimEnd('/'),
        token = "geheim",
        cfClientId = "cf-id",
        cfClientSecret = "cf-secret",
        client = OkHttpClient(),
    )

    @Test
    fun `parse schickt Text und Header, liest Rezept`() = runBlocking {
        val server = MockWebServer()
        server.enqueue(
            MockResponse().setBody(
                """{"ok":true,"recipe":{"slug":"dal","name":"Linsen-Dal","rating":"ok",
                   "simple":true,"reheatable":false,"tags":["vegetarisch"],"source":null,
                   "imageUrl":null,"servings":4,"prepMinutes":10,"cookMinutes":25,
                   "kcal":420,"protein":18,"carbs":55,"fat":9,
                   "ingredients":[{"name":"Rote Linsen","amount":"200","unit":"g","section":null}],
                   "steps":["Linsen waschen."]}}"""
            )
        )
        server.start()

        val draft = client(server).parse("roher text", null)

        val request = server.takeRequest()
        assertEquals("/api/recipes/parse", request.path)
        assertEquals("Bearer geheim", request.getHeader("Authorization"))
        assertEquals("cf-id", request.getHeader("CF-Access-Client-Id"))
        assertTrue(request.body.readUtf8().contains("roher text"))
        assertEquals("Linsen-Dal", draft.name)
        assertEquals(4, draft.servings)
        assertEquals(55, draft.nutrition?.carbs?.toInt())
        server.shutdown()
    }

    @Test
    fun `Fehlermeldung des Servers landet in der Exception`() = runBlocking {
        val server = MockWebServer()
        server.enqueue(
            MockResponse().setResponseCode(502)
                .setBody("""{"ok":false,"error":"Aus dem Text liess sich kein Rezept lesen."}""")
        )
        server.start()

        val e = runCatching { client(server).parse("murks", null) }.exceptionOrNull()
        assertTrue(e?.message!!.contains("kein Rezept lesen"))
        server.shutdown()
    }
}
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests '*DashboardClientTest*'`
Erwartung: FAIL — Klasse existiert nicht.

- [ ] **Step 3: DashboardClient implementieren**

Zuerst `domain/RecipeDraft.kt` um zwei Felder erweitern, damit Identität und Quelle den Preview-Editor überleben (`@Serializable` sorgt dafür, dass die vorhandene Persistenz in `SharedPreferences` sie automatisch mitnimmt):

```kotlin
    /** Vom Server vergebener Identitäts-Anker; leer bei handgetipptem Namen. */
    val slug: String? = null,
    /** Quell-URL, falls der Import von einem Link kam. */
    val sourceUrl: String? = null,
```

Dann `dashboard/DashboardClient.kt`:

```kotlin
package de.dml.rezeptimporter.dashboard

import de.dml.rezeptimporter.domain.IngredientDraft
import de.dml.rezeptimporter.domain.NutritionDraft
import de.dml.rezeptimporter.domain.RecipeDraft
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import kotlin.math.roundToInt

class DashboardException(message: String, cause: Throwable? = null) : Exception(message, cause)

data class SaveResult(val id: String, val name: String, val updated: Boolean)

private const val VEGETARIAN_TAG = "vegetarisch"

/**
 * Client für die beiden Import-Endpunkte des Haushalts-Dashboards. Die App
 * extrahiert nicht mehr selbst: `parse` schickt Rohtext (OCR, Caption) oder
 * eine Quell-URL hin und bekommt den fertigen Entwurf zurück, `save` schreibt
 * den — nach der Bearbeitung im Preview — in die Rezept-DB.
 */
class DashboardClient(
    private val baseUrl: String,
    private val token: String,
    private val cfClientId: String,
    private val cfClientSecret: String,
    private val client: OkHttpClient,
) {

    suspend fun parse(text: String, sourceUrl: String?): RecipeDraft = withContext(Dispatchers.IO) {
        val body = buildJsonObject {
            put("text", text)
            put("sourceUrl", sourceUrl)
        }
        val recipe = post("/api/recipes/parse", body)["recipe"]?.jsonObject
            ?: throw DashboardException("Antwort ohne Rezept")
        toDraft(recipe)
    }

    suspend fun save(draft: RecipeDraft): SaveResult = withContext(Dispatchers.IO) {
        val response = post("/api/recipes/import", buildJsonObject { put("recipe", toJson(draft)) })
        SaveResult(
            id = response["id"]?.jsonPrimitive?.contentOrNull.orEmpty(),
            name = response["name"]?.jsonPrimitive?.contentOrNull ?: draft.name,
            updated = response["updated"]?.jsonPrimitive?.booleanOrNull ?: false,
        )
    }

    // ---- HTTP ----

    private fun post(path: String, body: JsonObject): JsonObject {
        val builder = Request.Builder()
            .url("$baseUrl$path")
            .header("Authorization", "Bearer $token")
            .post(body.toString().toRequestBody("application/json".toMediaType()))
        // Im Heimnetz (http://192.168.178.91:3001) steht kein Cloudflare Access
        // davor — dann bleiben die Felder leer und die Header entfallen.
        if (cfClientId.isNotBlank() && cfClientSecret.isNotBlank()) {
            builder.header("CF-Access-Client-Id", cfClientId)
            builder.header("CF-Access-Client-Secret", cfClientSecret)
        }

        val raw = try {
            client.newCall(builder.build()).execute().use { resp ->
                val text = resp.body?.string().orEmpty()
                val json = runCatching { Json.parseToJsonElement(text).jsonObject }.getOrNull()
                if (!resp.isSuccessful) {
                    val message = json?.get("error")?.jsonPrimitive?.contentOrNull
                    // Access schickt bei falschem Service-Token HTML, kein JSON.
                    throw DashboardException(
                        message ?: "Dashboard HTTP ${resp.code}: ${text.take(200)}"
                    )
                }
                json ?: throw DashboardException("Dashboard-Antwort ist kein JSON")
            }
        } catch (e: IOException) {
            throw DashboardException("Dashboard nicht erreichbar: ${e.message}", e)
        }
        return raw
    }

    // ---- Mapping ----

    private fun toDraft(r: JsonObject): RecipeDraft {
        fun int(key: String) = r[key]?.jsonPrimitive?.intOrNull
        val tags = r["tags"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList()
        val nutrition = NutritionDraft(
            basis = "pro Portion",
            kcal = int("kcal"),
            protein = r["protein"]?.jsonPrimitive?.doubleOrNull,
            carbs = r["carbs"]?.jsonPrimitive?.doubleOrNull,
            fat = r["fat"]?.jsonPrimitive?.doubleOrNull,
        )
        return RecipeDraft(
            name = r["name"]?.jsonPrimitive?.content.orEmpty(),
            tags = tags,
            servings = int("servings"),
            prepMinutes = int("prepMinutes"),
            cookMinutes = int("cookMinutes"),
            ingredients = r["ingredients"]?.jsonArray?.map { element ->
                val i = element.jsonObject
                IngredientDraft(
                    name = i["name"]?.jsonPrimitive?.content.orEmpty(),
                    amount = i["amount"]?.jsonPrimitive?.contentOrNull,
                    unit = i["unit"]?.jsonPrimitive?.contentOrNull,
                    freshness = null,   // die DB kennt das Feld nicht mehr
                    section = i["section"]?.jsonPrimitive?.contentOrNull,
                )
            } ?: emptyList(),
            steps = r["steps"]?.jsonArray?.map { it.jsonPrimitive.content } ?: emptyList(),
            nutrition = nutrition.takeUnless { it.isEmpty },
            rating = r["rating"]?.jsonPrimitive?.contentOrNull ?: "ok",
            simple = r["simple"]?.jsonPrimitive?.booleanOrNull ?: true,
            reheatable = r["reheatable"]?.jsonPrimitive?.booleanOrNull ?: false,
            vegetarian = tags.any { it.equals(VEGETARIAN_TAG, ignoreCase = true) },
            slug = r["slug"]?.jsonPrimitive?.contentOrNull,
            sourceUrl = r["source"]?.jsonPrimitive?.contentOrNull,
        )
    }

    private fun toJson(draft: RecipeDraft): JsonObject = buildJsonObject {
        put("slug", draft.slug)          // leer: der Server leitet ihn aus dem Namen ab
        put("name", draft.name)
        put("rating", draft.rating)
        put("simple", draft.simple)
        put("reheatable", draft.reheatable)
        // Der Vegetarisch-Schalter im Preview ist die Entscheidung des Nutzers und
        // sticht die Serverheuristik — er wirkt hier auf den Tag.
        putJsonArray("tags") {
            val rest = draft.tags.filterNot { it.equals(VEGETARIAN_TAG, ignoreCase = true) }
            (if (draft.vegetarian) rest + VEGETARIAN_TAG else rest).forEach { add(it) }
        }
        put("source", draft.sourceUrl)
        put("imageUrl", JsonNull)
        put("servings", draft.servings)
        put("prepMinutes", draft.prepMinutes)
        put("cookMinutes", draft.cookMinutes)
        put("kcal", draft.nutrition?.kcal)
        put("protein", draft.nutrition?.protein?.roundToInt())
        put("carbs", draft.nutrition?.carbs?.roundToInt())
        put("fat", draft.nutrition?.fat?.roundToInt())
        putJsonArray("ingredients") {
            draft.ingredients.forEach { i ->
                addJsonObject {
                    put("name", i.name)
                    put("amount", i.amount)
                    put("unit", i.unit)
                    put("section", i.section)
                }
            }
        }
        putJsonArray("steps") { draft.steps.forEach { add(it) } }
    }
}
```

- [ ] **Step 4: Test laufen lassen**

Run: `cd android && ./gradlew :app:testDebugUnitTest --tests '*DashboardClientTest*'`
Erwartung: PASS.

- [ ] **Step 5: AppSettings umbauen**

In `settings/AppSettings.kt`: `enum class Provider`, `provider`, `geminiKey`, `anthropicKey`, `vaultUri`, `saveFolder`, `saveFolders`, `withDashboardFirst`, `DEFAULT_FOLDER` und `DEFAULT_FOLDERS` löschen. Stattdessen, im selben `EncryptedSharedPreferences`-Stil:

```kotlin
    /** Basis-URL des Dashboards, ohne Slash am Ende. Zuhause die LAN-Adresse,
     *  unterwegs der Cloudflare-Hostname. */
    var dashboardUrl: String
        get() = prefs.getString("dashboard_url", "")!!
        set(v) = prefs.edit().putString("dashboard_url", v.trim().trimEnd('/')).apply()

    /** Wert von RECIPE_IMPORT_TOKEN aus web/.env. */
    var importToken: String
        get() = prefs.getString("import_token", "")!!
        set(v) = prefs.edit().putString("import_token", v.trim()).apply()

    /** Cloudflare-Access-Service-Token; leer lassen, wenn direkt ins LAN gefunkt wird. */
    var cfClientId: String
        get() = prefs.getString("cf_client_id", "")!!
        set(v) = prefs.edit().putString("cf_client_id", v.trim()).apply()

    var cfClientSecret: String
        get() = prefs.getString("cf_client_secret", "")!!
        set(v) = prefs.edit().putString("cf_client_secret", v.trim()).apply()
```

`darkMode` bleibt unverändert.

- [ ] **Step 6: ShareActivity verdrahten**

In `ui/ShareActivity.kt`:

- Imports auf `llm.*`, `pipeline.ImportPipeline`, `validate.RecipeValidator`, `vault.*`, `yaml.RecipeMarkdownWriter` entfernen, `dashboard.DashboardClient` ergänzen.
- Felder `validator` und `markdownWriter` löschen, dazu die `RecipeValidator(assets.open(...))`-Zeile in `onCreate`.
- `buildExtractor()` komplett löschen.
- In `runImport()` die Vault-Prüfung ersetzen:

```kotlin
                if (settings.dashboardUrl.isBlank() || settings.importToken.isBlank()) {
                    state.value = ImportState.Error(
                        "Dashboard nicht eingerichtet — erst App öffnen, Adresse und Token eintragen."
                    )
                    return@launch
                }
```

- Den Rumpf ab `val shareUrl = extractShareUrl(source)` ersetzen. Der `RecipeLinkResolver` bleibt: Instagram- und TikTok-Captions holt weiterhin die App, weil sie die Links im Share-Intent bekommt. Ein reiner Web-Link geht dagegen roh ans Dashboard, das ihn ohne LLM auflöst:

```kotlin
                val shareUrl = extractShareUrl(source)
                val dashboard = DashboardClient(
                    baseUrl = settings.dashboardUrl,
                    token = settings.importToken,
                    cfClientId = settings.cfClientId,
                    cfClientSecret = settings.cfClientSecret,
                    client = httpClient,
                )
                val socialUrl = shareUrl?.takeIf {
                    LinkHosts.isSocial(it) || LinkHosts.isYouTube(it)
                }
                val draft = when {
                    // Instagram/TikTok/YouTube: die Caption bzw. Beschreibung holt weiter
                    // die App — sie hat die Links aus dem Share-Intent.
                    socialUrl != null ->
                        dashboard.parse(RecipeLinkResolver(httpClient).resolve(socialUrl), socialUrl)
                    // Web-Portal: roh ans Dashboard, das löst es ohne LLM aus dem Markup.
                    shareUrl != null -> dashboard.parse("", shareUrl)
                    else -> dashboard.parse(source, null)
                }
                persistDraft(draft)
                state.value = ImportState.Preview(draft)
```

`LinkHosts.isSocial` deckt nur TikTok und Instagram ab, YouTube hat mit `isYouTube` eine eigene Prüfung — beide sind nötig, sonst landet ein YouTube-Link beim Web-Resolver. `LinkHosts` ist `internal`, also aus `ui/` heraus sichtbar.

- `save()` neu:

```kotlin
    private fun save(draft: RecipeDraft) {
        lifecycleScope.launch {
            try {
                val result = DashboardClient(
                    baseUrl = settings.dashboardUrl,
                    token = settings.importToken,
                    cfClientId = settings.cfClientId,
                    cfClientSecret = settings.cfClientSecret,
                    client = httpClient,
                ).save(draft)
                Toast.makeText(
                    this@ShareActivity,
                    if (result.updated) "Aktualisiert: ${result.name}" else "Gespeichert: ${result.name}",
                    Toast.LENGTH_LONG,
                ).show()
                clearPhotoCache()
                finish()
            } catch (e: Exception) {
                state.value = ImportState.Error("Speichern fehlgeschlagen: ${e.message}")
            }
        }
    }
```

- Im `PreviewScreen`-Aufruf `folders` und `defaultFolder` streichen, `onSave = ::save`.
- Die Statuszeile `"Markdown wird erstellt …"` in `ProgressLines` durch `"Rezept wird geprüft …"` ersetzen — Markdown entsteht nicht mehr.

- [ ] **Step 7: PreviewScreen entschlacken**

In `ui/PreviewScreen.kt` die Parameter `folders: List<String>` und `defaultFolder: String` entfernen, `onSave` zu `(RecipeDraft) -> Unit` ändern und die Ordner-Auswahl-Composables samt ihrem State löschen. Die Felder für Bewertung, „einfach", „aufwärmbar" und die Zutaten-/Schritt-Editoren bleiben unangetastet.

- [ ] **Step 8: MainActivity-Einstellungen umbauen**

In `ui/MainActivity.kt`:

- Die Launcher und den State für den Vault-Ordner (`vaultUriState`, der `OpenDocumentTree`-Launcher, `settings.vaultUri = uri`) löschen.
- In der `setContent`-Lambda die `remember`-Zeilen für `provider`, `geminiKey`, `anthropicKey`, `saveFolder`, `saveFolders` ersetzen durch:

```kotlin
                var dashboardUrl by remember { mutableStateOf(settings.dashboardUrl) }
                var importToken by remember { mutableStateOf(settings.importToken) }
                var cfClientId by remember { mutableStateOf(settings.cfClientId) }
                var cfClientSecret by remember { mutableStateOf(settings.cfClientSecret) }
```

- `vaultOk`/`keyOk` ersetzen durch `val setupOk = dashboardUrl.isNotBlank() && importToken.isNotBlank()`; die `EquipmentRow`-Zeilen auf dem Home-Screen entsprechend auf „Dashboard" und „Token" umbenennen.
- `SettingsScreen` bekommt statt der Vault-, Ordner- und Key-Parameter vier Textfelder mit den obigen Werten. Beschriftungen: „Dashboard-Adresse" (Platzhalter `https://cockpit.domelehmann.org`), „Import-Token", „Cloudflare Client-Id (optional)", „Cloudflare Client-Secret (optional)". Token-Felder mit `PasswordVisualTransformation`, wie es die Key-Felder heute schon tun.

- [ ] **Step 9: Toten Code löschen**

```bash
cd android/app/src
rm -r main/java/de/dml/rezeptimporter/llm
rm -r main/java/de/dml/rezeptimporter/pipeline
rm -r main/java/de/dml/rezeptimporter/validate
rm -r main/java/de/dml/rezeptimporter/vault
rm -r main/java/de/dml/rezeptimporter/yaml
rm main/assets/recipe-vault-frontmatter.schema.json
rm -r test/java/de/dml/rezeptimporter/llm
rm -r test/java/de/dml/rezeptimporter/pipeline
rm -r test/java/de/dml/rezeptimporter/validate
rm -r test/java/de/dml/rezeptimporter/vault
rm -r test/java/de/dml/rezeptimporter/yaml
cd ../../.. && rm -r validator
```

**Achtung:** `pipeline/ImportPipeline.kt` enthält auch `isBareUrl` und `extractShareUrl`, die `ShareActivity` weiter braucht, und `test/.../pipeline/UrlDetectionTest.kt` testet sie. Beide Funktionen vorher nach `link/ShareText.kt` verschieben und den Test dorthin mitnehmen, statt sie zu löschen. Ebenso prüfen, ob `domain/Slug.kt` noch gebraucht wird — wenn nicht, mit weg.

- [ ] **Step 10: Build und Tests**

Run: `cd android && ./gradlew :app:assembleDebug :app:testDebugUnitTest --no-daemon`
Erwartung: BUILD SUCCESSFUL, alle verbliebenen Tests grün. Übrig bleiben die Tests zu `link/`, `domain/` und `dashboard/`.

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "feat: Rezepte gehen ans Dashboard statt in den Vault"
```

---

### Task 8: Tablet-Migration, Deploy und Doku

**Files:**
- Modify: `docs/rezepte-quellen-und-import.md`
- Modify: `docs/superpowers/plans/2026-08-26-rezeptimport-ueber-dashboard.md` (Stand nachtragen)

**Interfaces:**
- Consumes: alles aus den Tasks 1–7.

- [ ] **Step 1: Token erzeugen und in die Tablet-Env schreiben**

```bash
openssl rand -hex 32   # Ergebnis merken, kommt gleich zweimal zum Einsatz
ssh -p 8022 u0_a353@192.168.178.91
echo 'RECIPE_IMPORT_TOKEN=<der Wert>' >> ~/haushalts-dashboard/web/.env
```

- [ ] **Step 2: Schema am Tablet nachziehen**

`prisma migrate` läuft dort nicht. Deshalb direkt über better-sqlite3, aus `web/` heraus damit `require` auflöst:

```bash
cd ~/haushalts-dashboard/web
node -e "
const db = require('better-sqlite3')('dev.db');
for (const sql of [
  'ALTER TABLE Recipe ADD COLUMN carbs INTEGER',
  'ALTER TABLE Recipe ADD COLUMN fat INTEGER',
  'ALTER TABLE Ingredient ADD COLUMN section TEXT',
]) { try { db.prepare(sql).run(); console.log('ok:', sql); } catch (e) { console.log('schon da:', e.message); } }
"
```

Erwartung: dreimal `ok:`. Ein zweiter Lauf meldet „schon da" — der Befehl ist absichtlich wiederholbar.

- [ ] **Step 3: Deployen**

In **einer** SSH-Sitzung, sonst sterben abgesetzte Prozesse am flakigen Exit:

```bash
cd ~/haushalts-dashboard && git pull --ff-only && npm install && npx prisma generate \
  && cd web && npx next build --webpack && ~/restart-dashboard.sh
curl -s -o /dev/null -w "%{http_code}\n" localhost:3001
```

Erwartung: `200`.

- [ ] **Step 4: End-to-End gegen das Tablet prüfen**

Vom Rechner aus, im LAN (kein Cloudflare Access davor):

```bash
TOKEN=<der Wert aus Step 1>
curl -s -X POST http://192.168.178.91:3001/api/recipes/parse \
  -H "authorization: Bearer $TOKEN" -H 'content-type: application/json' \
  -d '{"text":"Linsen-Dal für 4\n200 g rote Linsen\n1 Dose Kokosmilch\nDip\n150 g Skyr\n\nLinsen waschen. 25 Minuten köcheln."}'
```

Erwartung: `{"ok":true,"recipe":{...}}` mit deutschem Namen, `section: "Dip"` bei Skyr, `tags` inklusive `vegetarisch`. Danach dieselbe Antwort als `{"recipe": ...}` an `/api/recipes/import` schicken und prüfen, dass das Rezept unter *Essen → Rezepte* auftaucht.

- [ ] **Step 5: Cloudflare-Access-Service-Token anlegen**

Im Cloudflare-Dashboard: **Zero Trust → Access → Service Auth → Service Tokens → Create Service Token**, Name `ObsidiDine`. Client-Id und Client-Secret notieren (das Secret wird nur einmal gezeigt). Anschließend in der Access-Application `Cockpit` eine Policy mit Action *Service Auth* und Include *Service Token → ObsidiDine* ergänzen. Beide Werte zusammen mit `RECIPE_IMPORT_TOKEN` und `https://cockpit.domelehmann.org` in den ObsidiDine-Einstellungen eintragen.

- [ ] **Step 6: Doku nachziehen**

In `docs/rezepte-quellen-und-import.md` den Abschnitt *2. Der Weg ins Rezeptbuch* um den dritten Weg ergänzen: **Am Handy per Teilen-Menü (ObsidiDine)** — Foto einer Rezeptkarte oder Instagram-/TikTok-Caption teilen, das Dashboard extrahiert über das Claude-Abo, Preview im Handy, dann speichern. Dazu unter *4. Technisches* die neuen Dateien nennen: `recipeExtract.ts`, `claudeCli.ts`, `vegetarianTag.ts`, die zwei Routen, `RECIPE_IMPORT_TOKEN` und `CLAUDE_CODE_OAUTH_TOKEN`. Den Absatz über die Obsidian-Werkzeuge stehen lassen — er stimmt weiterhin.

- [ ] **Step 7: Commit**

```bash
git add docs
git commit -m "docs(rezepte): Weg ueber ObsidiDine und die neuen Endpunkte"
```

---

## Offene Punkte, bewusst nicht Teil dieses Plans

- **Die PWA könnte die App ersetzen.** Web Share Target plus Foto-Upload im Dashboard würde ObsidiDine überflüssig machen — kein APK-Bau, kein Sideload. Dagegen steht der gerade erst gebaute Editor in der App und die kostenlose, offline laufende ML-Kit-OCR. Frühestens sinnvoll, wenn der Editor auf beiden Seiten ohnehin gepflegt werden müsste.
- **`freshness` fällt weg.** Die Spalte wurde am 2026-07-08 aus dem Schema entfernt (`meal_ingredients_pushed_and_drop_freshness`). Die App erfasst das Feld weiter, es wird beim Import verworfen.
- **Rezeptbilder aus Fotos.** Der Import über Rohtext liefert kein Titelbild. Ein Bild aus dem geteilten Foto zu übernehmen wäre möglich, ist hier aber nicht vorgesehen.
- **Abo-Kontingent.** Jeder Extraktions-Aufruf trägt rund 28k Kontext-Tokens (Claude Codes eigener System-Prompt), gemessen am 2026-08-26. Bei ein paar Rezepten pro Woche irrelevant; würde der Import je automatisiert laufen, wäre das die erste Stellschraube.

---

### Task 9: Kohlenhydrate, Fett und Zutaten-Gruppen im Dashboard

**Reihenfolge:** direkt nach Task 2 ausführen, vor Task 3.

**Warum diese Task existiert:** Tasks 1 und 2 legen `carbs`, `fat` und
`section` in der DB ab, aber nichts zeigt sie an und nichts trägt sie durch
den Editor. Zwei Folgen, beide inakzeptabel:

1. Die beiden Nährwerte wären gespeichert, aber weder sichtbar noch
   editierbar — „getrackt" wäre damit nur die halbe Wahrheit.
2. **Datenverlust:** `recipeFormDraft` kennt kein `section`. Wer ein
   importiertes Rezept im Dashboard-Editor auch nur öffnet und speichert,
   verliert alle Zutaten-Gruppen, weil `toRecipeInput` sie nicht
   zurückschreibt.

Punkt 2 ist der wichtigere. Gruppen im Editor zu **bearbeiten** ist hier
nicht verlangt — sie müssen den Rundlauf nur unbeschadet überstehen.

**Files:**
- Modify: `web/src/lib/data.ts` (`Recipe`, `RecipeIngredient`)
- Modify: `web/src/lib/repositories/recipes.ts` (Row-Typ, `select`, Zeilen-Mapping)
- Modify: `web/src/lib/services/recipeForm.ts` (`RecipeDraft`, `RecipeDraftIngredient`, `EMPTY_INGREDIENT`, `toRecipeFormDraft`, `toRecipeInput`)
- Modify: `web/src/components/mobile/RecipeEditor.tsx` (zwei `NumberField`)
- Modify: `web/src/app/(mobile)/mobile/meals/rezepte/[id]/page.tsx` (zwei Chips)
- Test: `web/src/lib/services/recipeForm.test.ts`, `web/src/lib/repositories/recipes.test.ts`

**Interfaces:**
- Consumes: `Recipe.carbs`/`.fat` und `Ingredient.section` aus Task 1.
- Produces: `Recipe` und `RecipeIngredient` (DTO) mit den neuen Feldern; der
  Formular-Rundlauf `toRecipeFormDraft` → `toRecipeInput` erhält `section`.

- [ ] **Step 1: Die failing tests schreiben**

In `web/src/lib/services/recipeForm.test.ts`:

```ts
  it("trägt Kohlenhydrate und Fett durch den Formular-Rundlauf", () => {
    const draft = toRecipeFormDraft({ ...RECIPE, carbs: 55, fat: 9 });
    expect(draft.carbs).toBe("55");
    expect(draft.fat).toBe("9");
    const input = toRecipeInput(draft);
    expect(input.carbs).toBe(55);
    expect(input.fat).toBe(9);
  });

  it("verliert Zutaten-Gruppen beim Bearbeiten nicht", () => {
    const draft = toRecipeFormDraft({
      ...RECIPE,
      ingredients: [
        { id: "1", name: "Rote Linsen", amount: "200", unit: "g", section: null },
        { id: "2", name: "Skyr", amount: "150", unit: "g", section: "Dip" },
      ],
    });
    expect(toRecipeInput(draft).ingredients?.map((i) => i.section)).toEqual([null, "Dip"]);
  });
```

`RECIPE` ist die in dieser Datei bereits vorhandene Fixture — sie muss um
`carbs: null, fat: null` und `section: null` je Zutat ergänzt werden, sonst
schlägt der Typecheck in allen bestehenden Tests fehl.

In `web/src/lib/repositories/recipes.test.ts`:

```ts
  it("gibt carbs, fat und section im DTO zurück", async () => {
    const id = await seedCurry();
    const recipe = await getRecipe(id);
    expect(recipe).toHaveProperty("carbs");
    expect(recipe).toHaveProperty("fat");
    expect(recipe?.ingredients[0]).toHaveProperty("section");
  });
```

- [ ] **Step 2: Tests laufen lassen, Fehlschlag bestätigen**

Run: `cd web && npx vitest run src/lib/services/recipeForm.test.ts src/lib/repositories/recipes.test.ts`
Erwartung: FAIL — `carbs`/`fat`/`section` existieren auf den DTO- und Draft-Typen nicht.

- [ ] **Step 3: DTO und Mapping erweitern**

In `web/src/lib/data.ts`, im `Recipe`-Typ unter `protein: number | null;`:

```ts
  carbs: number | null;
  fat: number | null;
```

und im `RecipeIngredient`-Typ unter `unit`:

```ts
  section: string | null;
```

In `web/src/lib/repositories/recipes.ts`: den internen Row-Typ um
`carbs: number | null;` und `fat: number | null;` erweitern, im
`ingredients`-Teil des Row-Typs um `section: string | null`. Falls die
Prisma-Abfragen die Spalten per `select` einschränken, `carbs`, `fat` und
`section` dort ergänzen — sonst kommen sie nie an. Im Zeilen-Mapping unter
`protein: row.protein,`:

```ts
    carbs: row.carbs,
    fat: row.fat,
```

und im Zutaten-Mapping:

```ts
      (i): RecipeIngredient => ({
        id: i.id, name: i.name, amount: i.amount, unit: i.unit, section: i.section,
      }),
```

- [ ] **Step 4: Formular durchlässig machen**

In `web/src/lib/services/recipeForm.ts`:

- `RecipeDraft` um `carbs: string;` und `fat: string;` unter `protein` erweitern.
- `RecipeDraftIngredient` um `section: string | null;` erweitern.
- `EMPTY_INGREDIENT` auf `{ name: "", amount: "", unit: "", section: null }` setzen.
- Im leeren Draft (dort, wo `kcal: ""` steht) `carbs: ""` und `fat: ""` ergänzen.
- In `toRecipeFormDraft` unter `protein: numberField(recipe.protein),`:

```ts
    carbs: numberField(recipe.carbs),
    fat: numberField(recipe.fat),
```

  und im Zutaten-Mapping derselben Funktion `section: i.section ?? null,` mitnehmen.
- In `toRecipeInput` unter `protein: parseOptionalInt(draft.protein),`:

```ts
    carbs: parseOptionalInt(draft.carbs),
    fat: parseOptionalInt(draft.fat),
```

  und im Zutaten-Mapping `section: i.section` mitgeben.

- [ ] **Step 5: Editor-Felder ergänzen**

In `web/src/components/mobile/RecipeEditor.tsx`, direkt hinter dem
`NumberField` für „Eiweiß":

```tsx
        <NumberField
          label="Kohlenhydrate"
          suffix="g/Portion"
          value={draft.carbs}
          onChange={(v) => set("carbs", v)}
        />
        <NumberField
          label="Fett"
          suffix="g/Portion"
          value={draft.fat}
          onChange={(v) => set("fat", v)}
        />
```

- [ ] **Step 6: Chips auf der Detailseite**

In `web/src/app/(mobile)/mobile/meals/rezepte/[id]/page.tsx`, direkt hinter
dem `protein`-Chip:

```tsx
        {recipe.carbs !== null && (
          <span className={CHIP}>
            <Wheat size={11} strokeWidth={2.2} />
            {recipe.carbs} g Kohlenhydrate
          </span>
        )}
        {recipe.fat !== null && (
          <span className={CHIP}>
            <Droplet size={11} strokeWidth={2.2} />
            {recipe.fat} g Fett
          </span>
        )}
```

`Wheat` und `Droplet` zur bestehenden `lucide-react`-Import-Zeile ergänzen —
beide Icons sind in der installierten Version vorhanden (gegengeprüft).

- [ ] **Step 7: Tests, Lint, Typecheck**

Run: `cd web && npm test && npm run lint && npm run typecheck`
Erwartung: PASS. Der Typecheck ist hier der eigentliche Wächter: Er findet
jede Fixture und jeden Aufrufer, die um die neuen Pflichtfelder ergänzt
werden müssen.

- [ ] **Step 8: Commit**

```bash
git add web/src
git commit -m "feat(rezepte): Kohlenhydrate und Fett im Editor, Gruppen ueberleben das Bearbeiten"
```
