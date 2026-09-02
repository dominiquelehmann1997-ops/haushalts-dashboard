# Import-Tempo und Rezept-Kategorien — Implementierungsplan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rezepte bekommen eine Kategorie, die Snacks und Süßes aus dem Wochenplan hält, und der Import über ObsidiDine blockiert nicht mehr 71 Sekunden lang eine einzelne HTTP-Verbindung.

**Architecture:** Drei unabhängige Schichten. (1) Eine neue Spalte `Recipe.category` mit Default `hauptmahlzeit` wandert durch Domain, Repository, Import-Weg und die beiden Oberflächen. (2) Der Extraktions-Prompt verliert seine HelloFresh-Sonderregeln und erzeugt knappere Schritte — weniger Ausgabe heißt weniger Zeit. (3) `POST /api/recipes/parse` bekommt einen asynchronen Modus: die Route legt einen Job in einer In-Memory-Map an, antwortet sofort mit einer Id, und die App pollt per `GET`. Damit dauert kein einzelner Request mehr als Millisekunden und das ~100-Sekunden-Limit der Cloudflare-Edge kann nicht mehr greifen.

**Tech Stack:** Next.js 16 (App Router), Prisma mit `@prisma/adapter-better-sqlite3`, Vitest, Kotlin/Jetpack Compose mit OkHttp und MockWebServer.

**Spec:** `docs/superpowers/specs/2026-09-02-import-tempo-und-rezeptkategorien-design.md`

## Global Constraints

- **Zwei Repos.** Dashboard: `C:\Users\ThinkPad\Documents\Claude\Dashboard` (Branch `rezept-tempo-kategorien`). App: `C:\Users\ThinkPad\Documents\Claude\Rezept-Importer` (Branch `main`, für diese Arbeit Branch `kategorien-und-async` anlegen).
- **Kategorie-Werte:** genau `hauptmahlzeit` | `snack` | `suesses`. Kleinschreibung, keine Umlaute. Unbekannte oder fehlende Werte fallen **immer still** auf `hauptmahlzeit` zurück, nie auf einen Fehler.
- **Sprache:** Kommentare, Commit-Nachrichten und UI-Texte auf Deutsch, wie im übrigen Repo. Code-Bezeichner englisch.
- **Prisma-Migrationen laufen auf dem Tablet nicht.** Schemaänderungen werden dort als rohes SQL über `better-sqlite3` angewandt; danach zwingend `node_modules/.bin/prisma generate` — **niemals** `npx prisma generate` (scheitert auf arm64, und zwar still).
- **Tests:** `cd web && node_modules/.bin/vitest run <datei>`. Der Flag `--reporter=basic` existiert in dieser Vitest-Version nicht und lässt den Lauf mit `ERR_LOAD_URL` scheitern — weglassen.
- **Android-Tests:** `cd android && ./gradlew :app:testDebugUnitTest --console=plain`.
- **Nach jedem Task committen.** Kein Push, kein Deploy — beides passiert gesammelt in Task 10.

---

### Task 1: Kategorie in Schema, Domain und Repository

Die Datenschicht zuerst, sonst wird zweimal migriert.

**Files:**
- Modify: `web/prisma/schema.prisma` (Model `Recipe`, nach `archived`)
- Modify: `web/src/lib/data.ts` (`Recipe`, `RecipeFilter`)
- Modify: `web/src/lib/repositories/recipes.ts` (`RecipeInput`, `RecipeRow`, `toRecipe`, `fieldsFrom`, `upsertImportedRecipe`)
- Modify: `web/src/lib/services/recipeImport.ts` (`ImportedRecipe`)
- Test: `web/src/lib/repositories/recipes.test.ts`

**Interfaces:**
- Consumes: nichts.
- Produces: `RecipeCategory = "hauptmahlzeit" | "snack" | "suesses"` und `normalizeCategory(value: unknown): RecipeCategory`, beide exportiert aus `web/src/lib/data.ts`. `Recipe.category: RecipeCategory`, `RecipeInput.category?: string`, `ImportedRecipe.category: RecipeCategory`.

- [ ] **Step 1: Schema erweitern**

In `web/prisma/schema.prisma`, im Model `Recipe` direkt unter `archived`:

```prisma
  /// "hauptmahlzeit" | "snack" | "suesses" — nur Hauptmahlzeiten landen im Wochenplan.
  category String @default("hauptmahlzeit")
```

- [ ] **Step 2: Spalte in der lokalen Entwicklungs-DB anlegen**

```bash
cd web && node -e "const db=require('better-sqlite3')('dev.db'); db.exec(\"ALTER TABLE Recipe ADD COLUMN category TEXT NOT NULL DEFAULT 'hauptmahlzeit'\"); console.log('ok')"
```

Wirft die Anweisung `duplicate column name`, ist die Spalte schon da — das ist in Ordnung, weitermachen.

- [ ] **Step 3: Prisma-Client neu erzeugen**

```bash
cd web && node_modules/.bin/prisma generate
```

Gegenprobe, dass die Spalte wirklich im Client steckt:

```bash
grep -c "category" web/src/generated/prisma/models/Recipe.ts
```

Erwartet: Zahl größer 0. Ist sie 0, ist der Client veraltet und **alles Folgende scheitert zur Laufzeit, ohne dass der Build meckert**.

- [ ] **Step 4: Den fehlschlagenden Test schreiben**

In `web/src/lib/repositories/recipes.test.ts` ans Ende:

```ts
describe("category", () => {
  it("legt neue Rezepte als Hauptmahlzeit an", async () => {
    const { id } = await createRecipe({ name: "Testgericht" });
    const recipe = await getRecipe(id);
    expect(recipe?.category).toBe("hauptmahlzeit");
  });

  it("uebernimmt eine gesetzte Kategorie", async () => {
    const { id } = await createRecipe({ name: "Testriegel", category: "snack" });
    expect((await getRecipe(id))?.category).toBe("snack");
  });

  it("faellt bei Unfug auf hauptmahlzeit zurueck", async () => {
    const { id } = await createRecipe({ name: "Testunfug", category: "voelliger-quatsch" });
    expect((await getRecipe(id))?.category).toBe("hauptmahlzeit");
  });
});
```

- [ ] **Step 5: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/repositories/recipes.test.ts
```

Erwartet: FAIL — `category` existiert weder in `RecipeInput` noch im Ergebnis.

- [ ] **Step 6: Typ und Normalisierung in `data.ts`**

In `web/src/lib/data.ts` direkt unter `export type Rating`:

```ts
/** Kategorie eines Rezepts. Nur `hauptmahlzeit` kommt in den Wochenplan. */
export type RecipeCategory = "hauptmahlzeit" | "snack" | "suesses";

export const RECIPE_CATEGORIES: RecipeCategory[] = ["hauptmahlzeit", "snack", "suesses"];

/** Anzeigename je Kategorie — für Chips, Formular und App gleichermaßen. */
export const CATEGORY_LABELS: Record<RecipeCategory, string> = {
  hauptmahlzeit: "Hauptmahlzeit",
  snack: "Snack",
  suesses: "Süßes",
};

/**
 * Beliebigen Wert auf eine gültige Kategorie abbilden. Unbekanntes wird zur
 * Hauptmahlzeit — ein Rezept ohne brauchbare Kategorie soll planbar bleiben,
 * nicht unsichtbar werden.
 */
export function normalizeCategory(value: unknown): RecipeCategory {
  return RECIPE_CATEGORIES.includes(value as RecipeCategory)
    ? (value as RecipeCategory)
    : "hauptmahlzeit";
}
```

Im `interface Recipe` unter `archived`:

```ts
  category: RecipeCategory;
```

Im `interface RecipeFilter` unter `reheatableOnly`:

```ts
  /** Nur Rezepte dieser Kategorie. */
  category?: RecipeCategory;
```

- [ ] **Step 7: Export in `domain.ts` ergänzen**

In `web/src/lib/domain.ts` die Namen `RecipeCategory`, `RECIPE_CATEGORIES`, `CATEGORY_LABELS` und `normalizeCategory` mit aus `./data` re-exportieren, analog zu `RecipeFilter`. `normalizeCategory`, `RECIPE_CATEGORIES` und `CATEGORY_LABELS` sind Werte, keine Typen — sie gehören in ein `export { … } from "./data";`, nicht in den `export type { … }`-Block.

- [ ] **Step 8: Repository durchziehen**

In `web/src/lib/repositories/recipes.ts`:

- Import ergänzen: `normalizeCategory` und `RecipeCategory` aus `@/lib/domain`.
- `RecipeInput` bekommt `category?: string;` unter `reheatable`.
- `RecipeRow` bekommt `category: string;` unter `archived`.
- `toRecipe` gibt `category: normalizeCategory(row.category),` zurück.
- In `fieldsFrom` (die gemeinsame Feldabbildung für `createRecipe`/`updateRecipe`) analog zu `rating`:

```ts
    ...(input.category === undefined ? {} : { category: normalizeCategory(input.category) }),
```

- In `upsertImportedRecipe` wandert `category: normalizeCategory(recipe.category)` in dieselben Feldlisten wie `servings` und `kcal` — also sowohl in den `create`- als auch in den `update`-Zweig. Die Kategorie ist eine Aussage über das Rezept selbst, kein Nutzerurteil wie `rating`; ein erneuter Import darf sie überschreiben.

- [ ] **Step 9: `ImportedRecipe` erweitern**

In `web/src/lib/services/recipeImport.ts` im `interface ImportedRecipe` unter `reheatable`:

```ts
  /** "hauptmahlzeit" | "snack" | "suesses"; aus der Extraktion geraten, im App-Preview korrigierbar. */
  category: RecipeCategory;
```

`RecipeCategory` aus `@/lib/domain` importieren. Alle Stellen, die ein `ImportedRecipe` bauen, brauchen jetzt das Feld — der Compiler zeigt sie. Für den schema.org-Weg (`importRecipeFromUrl`) und die Rezept-Ideen (`recipeIdeas.ts`) ist `"hauptmahlzeit"` der richtige feste Wert; beide liefern keine Kategorie mit.

- [ ] **Step 10: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/repositories/recipes.test.ts src/lib/services/recipeImport.test.ts
```

Erwartet: PASS.

- [ ] **Step 11: Commit**

```bash
git add web/prisma/schema.prisma web/src/lib/data.ts web/src/lib/domain.ts web/src/lib/repositories/recipes.ts web/src/lib/repositories/recipes.test.ts web/src/lib/services/recipeImport.ts
git commit -m "feat(rezepte): Kategorie-Feld mit Default hauptmahlzeit"
```

---

### Task 2: Wochenplan zieht nur Hauptmahlzeiten

**Files:**
- Modify: `web/src/lib/services/mealPlanner.ts` (`generateWeekPlan`, die `findMany`-Abfrage)
- Modify: `web/src/lib/services/mealDraft.ts` (die `findMany`-Abfrage beim Neuwürfeln)
- Modify: `web/src/lib/repositories/recipes.ts` (`listRecipeOptions`)
- Test: `web/src/lib/services/mealPlanner.test.ts`

**Interfaces:**
- Consumes: `Recipe.category` aus Task 1.
- Produces: nichts Neues.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `web/src/lib/services/mealPlanner.test.ts` ans Ende. Die bestehenden Tests der Datei zeigen, wie Rezepte dort angelegt werden — dieselbe Hilfsfunktion benutzen und nur `category` ergänzen:

```ts
it("plant weder Snacks noch Suesses ein", async () => {
  // Einziges Rezept der DB ist ein Snack: es darf kein Plan entstehen.
  await createRecipe({ name: "Proteinriegel", category: "snack" });

  const entries = await generateWeekPlan(new Date("2026-09-07"), {});

  expect(entries).toEqual([]);
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/mealPlanner.test.ts
```

Erwartet: FAIL — der Riegel wird eingeplant, `entries` hat sieben Einträge.

- [ ] **Step 3: Beide Abfragen filtern**

In `web/src/lib/services/mealPlanner.ts` und `web/src/lib/services/mealDraft.ts` jeweils:

```ts
  const recipes = await client.recipe.findMany({
    // Snacks und Süßes sind keine Abendessen. Wer bewusst Kuchen einplanen
    // will, ändert vorher die Kategorie des Rezepts.
    where: { archived: false, category: "hauptmahlzeit" },
    orderBy: { name: "asc" },
  });
```

- [ ] **Step 4: `listRecipeOptions` mitziehen**

In `web/src/lib/repositories/recipes.ts` dieselbe `where`-Klausel. Das Dropdown zum manuellen Setzen eines Tages zeigt damit ebenfalls nur Hauptmahlzeiten. `listRecipes` und `listAllRecipes` bleiben ungefiltert — die Liste soll alles zeigen, das Backup erst recht.

- [ ] **Step 5: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/mealPlanner.test.ts src/lib/services/mealDraft.test.ts
```

Erwartet: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/mealPlanner.ts web/src/lib/services/mealDraft.ts web/src/lib/repositories/recipes.ts web/src/lib/services/mealPlanner.test.ts
git commit -m "feat(essensplan): nur Hauptmahlzeiten kommen in den Wochenplan"
```

---

### Task 3: Kategorie-Filter in der Rezeptliste

**Files:**
- Modify: `web/src/lib/services/recipeSearch.ts` (`applyFilters`)
- Modify: `web/src/lib/recipeFilterParams.ts` (`PARAM`, `parseRecipeFilter`, und die Href-Helfer)
- Modify: `web/src/components/mobile/RecipeFilterChips.tsx`
- Test: `web/src/lib/services/recipeSearch.test.ts`, `web/src/lib/recipeFilterParams.test.ts`

**Interfaces:**
- Consumes: `RecipeFilter.category`, `RECIPE_CATEGORIES`, `CATEGORY_LABELS` aus Task 1.
- Produces: URL-Parameter `kategorie`.

- [ ] **Step 1: Den fehlschlagenden Test für den Filter schreiben**

In `web/src/lib/services/recipeSearch.test.ts`:

```ts
it("filtert nach Kategorie", () => {
  const haupt = { ...BASE_RECIPE, id: "1", category: "hauptmahlzeit" as const };
  const snack = { ...BASE_RECIPE, id: "2", category: "snack" as const };

  expect(applyFilters([haupt, snack], { category: "snack" })).toEqual([snack]);
  expect(applyFilters([haupt, snack], {})).toHaveLength(2);
});
```

`BASE_RECIPE` ist das in der Datei bereits vorhandene Beispielrezept; heißt es dort anders, den vorhandenen Namen verwenden und `category` ergänzen.

- [ ] **Step 2: Den fehlschlagenden Test für den URL-Parameter schreiben**

In `web/src/lib/recipeFilterParams.test.ts`:

```ts
it("liest die Kategorie aus den Suchparametern", () => {
  expect(parseRecipeFilter({ kategorie: "snack" }).category).toBe("snack");
});

it("ignoriert eine unbekannte Kategorie", () => {
  expect(parseRecipeFilter({ kategorie: "quatsch" }).category).toBeUndefined();
});
```

Der Unterschied zu `normalizeCategory` ist Absicht: ein unsinniger **Filter** soll gar nicht filtern, ein unsinniger **Datensatz** wird zur Hauptmahlzeit.

- [ ] **Step 3: Tests laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeSearch.test.ts src/lib/recipeFilterParams.test.ts
```

Erwartet: FAIL in beiden Dateien.

- [ ] **Step 4: `applyFilters` erweitern**

In `web/src/lib/services/recipeSearch.ts`, direkt neben der `rating`-Zeile:

```ts
    if (filter.category && r.category !== filter.category) return false;
```

- [ ] **Step 5: URL-Parameter ergänzen**

In `web/src/lib/recipeFilterParams.ts`:

- `PARAM` bekommt `category: "kategorie",`.
- In `parseRecipeFilter`, im Stil der bestehenden `rating`-Behandlung:

```ts
  const category = firstValue(params[PARAM.category]);
  if (category && RECIPE_CATEGORIES.includes(category as RecipeCategory)) {
    filter.category = category as RecipeCategory;
  }
```

`RECIPE_CATEGORIES` und `RecipeCategory` aus `@/lib/domain` importieren.

- Die Datei enthält bereits `recipesHref` und `toggleField` zum Bauen der Chip-Links. `category` dort genauso behandeln wie `rating`: gleicher Wert erneut geklickt entfernt den Filter.

- [ ] **Step 6: Chips rendern**

In `web/src/components/mobile/RecipeFilterChips.tsx` eine eigene Chip-Reihe **vor** den Tag-Chips — die Kategorie ist die gröbere Einteilung und gehört nach oben:

```tsx
      <div className="flex gap-1.5 overflow-x-auto">
        {RECIPE_CATEGORIES.map((c) => (
          <Chip
            key={c}
            href={recipesHref(toggleField(filter, "category", c))}
            active={filter.category === c}
          >
            {CATEGORY_LABELS[c]}
          </Chip>
        ))}
      </div>
```

Die umgebenden Klassennamen an die bereits vorhandene Chip-Reihe der Datei angleichen.

- [ ] **Step 7: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeSearch.test.ts src/lib/recipeFilterParams.test.ts
```

Erwartet: PASS.

- [ ] **Step 8: Commit**

```bash
git add web/src/lib/services/recipeSearch.ts web/src/lib/recipeFilterParams.ts web/src/components/mobile/RecipeFilterChips.tsx web/src/lib/services/recipeSearch.test.ts web/src/lib/recipeFilterParams.test.ts
git commit -m "feat(rezepte): Kategorie als Filter in der Rezeptliste"
```

---

### Task 4: Kategorie im Rezept-Formular

**Files:**
- Modify: `web/src/lib/services/recipeForm.ts` (`RecipeDraft`, `emptyDraft`, `draftFromRecipe`, `draftToInput`)
- Modify: das Formular-Bauteil, das `rezepte/neu` und `rezepte/[id]/bearbeiten` gemeinsam nutzen (über `emptyDraft` als Einstiegspunkt finden)
- Test: `web/src/lib/services/recipeForm.test.ts`

**Interfaces:**
- Consumes: `RecipeCategory`, `RECIPE_CATEGORIES`, `CATEGORY_LABELS` aus Task 1.
- Produces: `RecipeDraft.category: RecipeCategory` im Formular-Modell (nicht zu verwechseln mit `RecipeDraft` in der Android-App).

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `web/src/lib/services/recipeForm.test.ts`:

```ts
it("startet neue Rezepte als Hauptmahlzeit", () => {
  expect(emptyDraft().category).toBe("hauptmahlzeit");
});

it("nimmt die Kategorie aus dem Rezept und gibt sie wieder heraus", () => {
  const draft = draftFromRecipe({ ...BASE_RECIPE, category: "suesses" });
  expect(draft.category).toBe("suesses");
  expect(draftToInput(draft).category).toBe("suesses");
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeForm.test.ts
```

Erwartet: FAIL.

- [ ] **Step 3: Formular-Modell erweitern**

In `web/src/lib/services/recipeForm.ts`: `RecipeDraft` bekommt `category: RecipeCategory;`, `emptyDraft()` setzt `category: "hauptmahlzeit"`, `draftFromRecipe` übernimmt `recipe.category`, `draftToInput` gibt `category: draft.category` weiter.

- [ ] **Step 4: Auswahlfeld einbauen**

Im Formular ein `<select>` direkt neben der bestehenden Bewertungs-Auswahl (`RATINGS`), gleiche Optik:

```tsx
<select
  value={draft.category}
  onChange={(e) => setDraft({ ...draft, category: e.target.value as RecipeCategory })}
>
  {RECIPE_CATEGORIES.map((c) => (
    <option key={c} value={c}>{CATEGORY_LABELS[c]}</option>
  ))}
</select>
```

- [ ] **Step 5: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeForm.test.ts
```

Erwartet: PASS.

- [ ] **Step 6: Commit**

```bash
git add web/src/lib/services/recipeForm.ts web/src/lib/services/recipeForm.test.ts web/src/app/\(mobile\)
git commit -m "feat(rezepte): Kategorie im Rezept-Formular waehlbar"
```

---

### Task 5: Extraktions-Prompt kürzen und Kategorie raten

**Files:**
- Modify: `web/src/lib/services/recipeExtract.ts` (`EXTRACTION_PROMPT`, `ExtractedRecipe`, `parseExtractionResponse`, `toImportedFromExtraction`)
- Test: `web/src/lib/services/recipeExtract.test.ts`

**Interfaces:**
- Consumes: `ImportedRecipe.category` aus Task 1, `normalizeCategory` aus Task 1.
- Produces: `ExtractedRecipe.category?: string | null`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `web/src/lib/services/recipeExtract.test.ts`:

```ts
it("liest die Kategorie aus der Antwort", () => {
  const raw = JSON.stringify({ ...EXTRACTED, category: "suesses" });
  expect(parseExtractionResponse(raw)?.category).toBe("suesses");
});

it("macht aus einer fehlenden Kategorie eine Hauptmahlzeit", () => {
  const imported = toImportedFromExtraction(EXTRACTED, null);
  expect(imported.category).toBe("hauptmahlzeit");
});

it("verwirft eine erfundene Kategorie", () => {
  const parsed = parseExtractionResponse(JSON.stringify({ ...EXTRACTED, category: "nachtisch" }));
  expect(toImportedFromExtraction(parsed!, null).category).toBe("hauptmahlzeit");
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeExtract.test.ts
```

Erwartet: FAIL — `category` ist unbekannt.

- [ ] **Step 3: Prompt kürzen**

In `EXTRACTION_PROMPT` **ersatzlos streichen**:

- den kompletten `- PORTIONEN:`-Block (Spalten `2P`/`3P`/`4P`),
- im `- "steps":`-Block die Sätze über mehrspaltig gescannte Rezeptkarten, das 3×2-Raster und die spaltenweise Gruppierung,
- die drei Beispielzeilen im `- ZUTATEN-GRUPPEN:`-Block (`"300g Hähnchenbrust" ⇒ …` bis `"150g Skyr" ⇒ …`) samt der Zeile `Beispiel:`; die Regel selbst und die Aufzählung der Überschrift-Beispiele bleiben,
- den kompletten Schlussabsatz `Prüfe vor dem Antworten selbst: …`.

Der `- "steps":`-Block schrumpft damit auf:

```
- "steps": Jeden Zubereitungsschritt knapp fassen, ein bis zwei Sätze. Sind
  Schrittnummern im Text, danach sortieren, die Nummern aber nicht in den
  Ausgabetext übernehmen.
```

- [ ] **Step 4: Kategorie-Regel und Format ergänzen**

Als neue Regel vor `- "nutrition" nur befüllen`:

```
- KATEGORIE: "category" ist "hauptmahlzeit" für richtige Gerichte,
  "snack" für Kleinigkeiten zwischendurch (Riegel, Bites, Dips, Aufstriche),
  "suesses" für Süßspeisen und Gebäck (Kuchen, Kekse, Desserts, Eis).
  Im Zweifel "hauptmahlzeit".
```

Im `Format:`-Block `"category": string` hinter `"tags": string[]` aufnehmen.

Den Dateikopf-Kommentar anpassen: die Regeln sind jetzt auf Instagram- und TikTok-Captions ausgerichtet, nicht mehr auf HelloFresh-Karten.

- [ ] **Step 5: Kategorie durchreichen**

`ExtractedRecipe` bekommt `category?: string | null;`. In `parseExtractionResponse` analog zu `name`:

```ts
    category: typeof e.category === "string" ? e.category : null,
```

In `toImportedFromExtraction` in das zurückgegebene Objekt:

```ts
    category: normalizeCategory(e.category),
```

`normalizeCategory` aus `@/lib/domain` importieren.

- [ ] **Step 6: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/recipeExtract.test.ts
```

Erwartet: PASS, alle Tests der Datei.

- [ ] **Step 7: Commit**

```bash
git add web/src/lib/services/recipeExtract.ts web/src/lib/services/recipeExtract.test.ts
git commit -m "perf(rezepte): Prompt auf Captions zuschneiden, Kategorie mitraten"
```

---

### Task 6: Job-Speicher für laufende Importe

**Files:**
- Create: `web/src/lib/services/importJobs.ts`
- Test: `web/src/lib/services/importJobs.test.ts`

**Interfaces:**
- Consumes: `ImportedRecipe` aus `@/lib/services/recipeImport`.
- Produces:
  - `type ImportJob = { status: "pending" } | { status: "done"; recipe: ImportedRecipe } | { status: "error"; error: string }`
  - `createJob(): string`
  - `readJob(id: string): ImportJob | null`
  - `finishJob(id: string, recipe: ImportedRecipe): void`
  - `failJob(id: string, error: string): void`
  - `JOB_TTL_MS = 600_000`
  - `__resetJobsForTest(): void`

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

`web/src/lib/services/importJobs.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  createJob,
  failJob,
  finishJob,
  JOB_TTL_MS,
  readJob,
  __resetJobsForTest,
} from "./importJobs";

const RECIPE = { slug: "dal", name: "Dal" } as never;

describe("importJobs", () => {
  beforeEach(() => __resetJobsForTest());

  it("startet einen Job als pending", () => {
    expect(readJob(createJob())?.status).toBe("pending");
  });

  it("kennt unbekannte Ids nicht", () => {
    expect(readJob("gibtsnicht")).toBeNull();
  });

  it("haelt das Ergebnis fest", () => {
    const id = createJob();
    finishJob(id, RECIPE);
    const job = readJob(id);
    expect(job).toEqual({ status: "done", recipe: RECIPE });
  });

  it("haelt einen Fehler fest", () => {
    const id = createJob();
    failJob(id, "kaputt");
    expect(readJob(id)).toEqual({ status: "error", error: "kaputt" });
  });

  it("behaelt das Ergebnis auch nach mehrfachem Lesen", () => {
    const id = createJob();
    finishJob(id, RECIPE);
    readJob(id);
    expect(readJob(id)?.status).toBe("done");
  });

  it("vergisst Jobs nach Ablauf der TTL", () => {
    vi.useFakeTimers();
    try {
      const id = createJob();
      finishJob(id, RECIPE);
      vi.advanceTimersByTime(JOB_TTL_MS + 1);
      expect(readJob(id)).toBeNull();
    } finally {
      vi.useRealTimers();
    }
  });

  it("ignoriert Ergebnisse fuer unbekannte Jobs", () => {
    expect(() => finishJob("gibtsnicht", RECIPE)).not.toThrow();
  });
});
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/importJobs.test.ts
```

Erwartet: FAIL — Modul existiert nicht.

- [ ] **Step 3: Modul schreiben**

`web/src/lib/services/importJobs.ts`:

```ts
// Zustand laufender Rezept-Importe. Bewusst nur im Speicher: ein Import lebt
// eine Minute, danach ist der Eintrag wertlos. Eine Tabelle dafür hieße eine
// Migration auf dem Android-Tablet für Wegwerfdaten.
//
// Das trägt, weil `next start` EIN Prozess ist. Liefe das Dashboard je mit
// mehreren Workern, landeten Start und Abfrage in verschiedenen Prozessen und
// dieser Ansatz bricht — dann muss der Zustand in die DB.

import type { ImportedRecipe } from "@/lib/services/recipeImport";

export type ImportJob =
  | { status: "pending" }
  | { status: "done"; recipe: ImportedRecipe }
  | { status: "error"; error: string };

/** Nach dieser Zeit wird ein Job vergessen, fertig oder nicht. */
export const JOB_TTL_MS = 600_000;

const jobs = new Map<string, { job: ImportJob; createdAt: number }>();

/**
 * Aufräumen beim Zugriff statt per Timer: ein `setInterval` im Modul-Scope
 * überlebt Hot-Reloads schlecht und hält den Prozess wach.
 */
function sweep(now: number): void {
  for (const [id, entry] of jobs) {
    if (now - entry.createdAt > JOB_TTL_MS) jobs.delete(id);
  }
}

export function createJob(): string {
  const now = Date.now();
  sweep(now);
  const id = crypto.randomUUID();
  jobs.set(id, { job: { status: "pending" }, createdAt: now });
  return id;
}

/**
 * Der Job wird beim Lesen NICHT gelöscht: die App könnte die Antwort verlieren
 * und erneut fragen. Die TTL räumt auf.
 */
export function readJob(id: string): ImportJob | null {
  sweep(Date.now());
  return jobs.get(id)?.job ?? null;
}

/** Ergebnisse für abgelaufene oder unbekannte Jobs fallen still unter den Tisch. */
function settle(id: string, job: ImportJob): void {
  const entry = jobs.get(id);
  if (entry) entry.job = job;
}

export function finishJob(id: string, recipe: ImportedRecipe): void {
  settle(id, { status: "done", recipe });
}

export function failJob(id: string, error: string): void {
  settle(id, { status: "error", error });
}

/** Nur für Tests. */
export function __resetJobsForTest(): void {
  jobs.clear();
}
```

- [ ] **Step 4: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/lib/services/importJobs.test.ts
```

Erwartet: PASS, sieben Tests.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/services/importJobs.ts web/src/lib/services/importJobs.test.ts
git commit -m "feat(rezepte): Job-Speicher fuer laufende Importe"
```

---

### Task 7: Asynchroner Modus der parse-Route

**Files:**
- Modify: `web/src/app/api/recipes/parse/route.ts`
- Test: `web/src/app/api/recipes/parse/route.test.ts`

**Interfaces:**
- Consumes: `createJob`, `readJob`, `finishJob`, `failJob` aus Task 6; `checkImportToken` aus `@/lib/api/importAuth`.
- Produces: `POST` mit `async: true` → `202 {ok, jobId}`; `GET ?job=<id>` → `200 {ok, status, recipe?, error?}` oder `404`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `web/src/app/api/recipes/parse/route.test.ts`. Die Datei mockt `extractRecipeFromText` bereits — dasselbe Muster weiterverwenden:

```ts
describe("asynchroner Modus", () => {
  it("antwortet sofort mit einer Job-Id", async () => {
    vi.mocked(extractRecipeFromText).mockResolvedValue(IMPORTED);

    const res = await POST(authorizedRequest({ text: "irgendwas", async: true }));

    expect(res.status).toBe(202);
    expect((await res.json()).jobId).toEqual(expect.any(String));
  });

  it("liefert das Ergebnis ueber GET nach", async () => {
    vi.mocked(extractRecipeFromText).mockResolvedValue(IMPORTED);
    const { jobId } = await (await POST(authorizedRequest({ text: "x", async: true }))).json();

    // Die Extraktion läuft als nicht abgewarteter Promise — eine Runde durch
    // die Microtask-Queue genügt, damit sie fertig ist.
    await new Promise((r) => setTimeout(r, 0));

    const res = await GET(authorizedGet(`?job=${jobId}`));
    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.recipe.name).toBe(IMPORTED.name);
  });

  it("meldet einen Fehler der Extraktion im Job", async () => {
    vi.mocked(extractRecipeFromText).mockRejectedValue(new Error("kein Rezept"));
    const { jobId } = await (await POST(authorizedRequest({ text: "x", async: true }))).json();
    await new Promise((r) => setTimeout(r, 0));

    const body = await (await GET(authorizedGet(`?job=${jobId}`))).json();
    expect(body).toMatchObject({ status: "error", error: "kein Rezept" });
  });

  it("kennt unbekannte Job-Ids nicht", async () => {
    expect((await GET(authorizedGet("?job=gibtsnicht"))).status).toBe(404);
  });

  it("laesst GET ohne Token nicht durch", async () => {
    const res = await GET(new Request("http://x/api/recipes/parse?job=egal"));
    expect(res.status).toBe(401);
  });
});
```

`authorizedRequest` existiert in der Datei bereits; `authorizedGet` analog dazu ergänzen (gleicher `Authorization`-Header, Methode `GET`, Query an die URL gehängt).

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd web && node_modules/.bin/vitest run src/app/api/recipes/parse/route.test.ts
```

Erwartet: FAIL — `GET` ist nicht exportiert.

- [ ] **Step 3: `POST` um den asynchronen Zweig erweitern**

In `web/src/app/api/recipes/parse/route.ts`, nach der bestehenden Prüfung auf leeren Text und **vor** dem synchronen `try`-Block:

```ts
  // Asynchron: Job anlegen, sofort antworten, im Hintergrund extrahieren. So
  // dauert kein einzelner Request länger als Millisekunden — das ~100s-Limit
  // der Cloudflare-Edge kann nicht mehr greifen.
  if (body?.async === true) {
    const jobId = createJob();
    void runExtraction(jobId, text, sourceUrl);
    return NextResponse.json({ ok: true, jobId }, { status: 202 });
  }
```

Den Body-Typ um `async?: unknown` erweitern.

Darunter die gemeinsame Hintergrundfunktion:

```ts
/**
 * Läuft absichtlich ohne `await` weiter, nachdem die Route schon geantwortet
 * hat. Wirft nie — jeder Fehler landet als Text im Job.
 */
async function runExtraction(jobId: string, text: string, sourceUrl: string | null) {
  try {
    const recipe =
      sourceUrl && text.trim() === ""
        ? await importRecipeFromUrl(sourceUrl)
        : await extractRecipeFromText(text, sourceUrl);
    finishJob(jobId, recipe);
  } catch (e) {
    failJob(jobId, e instanceof Error ? e.message : "Extraktion fehlgeschlagen.");
  }
}
```

- [ ] **Step 4: `GET` ergänzen**

In derselben Datei:

```ts
export async function GET(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const id = new URL(request.url).searchParams.get("job");
  const job = id ? readJob(id) : null;
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job unbekannt oder abgelaufen." },
      { status: 404 },
    );
  }
  // Der Status steht im Body, nicht im HTTP-Code: ein laufender Job ist kein
  // Fehler, und der DashboardClient wirft bei jedem non-2xx.
  return NextResponse.json({ ok: true, ...job });
}
```

- [ ] **Step 5: Tests laufen lassen**

```bash
cd web && node_modules/.bin/vitest run src/app/api/recipes/parse/route.test.ts
```

Erwartet: PASS, auch die bestehenden Tests des synchronen Wegs.

- [ ] **Step 6: Commit**

```bash
git add web/src/app/api/recipes/parse/route.ts web/src/app/api/recipes/parse/route.test.ts
git commit -m "feat(rezepte): parse-Route kann Importe als Job fahren"
```

---

### Task 8: App pollt statt zu warten

Ab hier im Repo `Rezept-Importer`. Zuerst `git checkout -b kategorien-und-async`.

**Files:**
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt` (`ImportState.Working`)
- Test: `android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt`

**Interfaces:**
- Consumes: das Job-Protokoll aus Task 7.
- Produces: `DashboardClient.parse` behält seine Signatur `suspend fun parse(text: String, sourceUrl: String?): RecipeDraft`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

In `DashboardClientTest.kt`. Die Datei nutzt `MockWebServer` und `runBlocking` bereits:

```kotlin
@Test
fun `parse startet einen Job und pollt bis done`() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(202).setBody("""{"ok":true,"jobId":"j1"}"""))
    server.enqueue(MockResponse().setBody("""{"ok":true,"status":"pending"}"""))
    server.enqueue(
        MockResponse().setBody("""{"ok":true,"status":"done","recipe":{"name":"Dal","steps":["kochen"],"ingredients":[]}}""")
    )

    val draft = client(server).parse("roher text", null)

    assertEquals("Dal", draft.name)
    val start = server.takeRequest()
    assertEquals("POST", start.method)
    assertTrue(start.body.readUtf8().contains("\"async\":true"))
    assertTrue(server.takeRequest().path!!.contains("job=j1"))
}

@Test
fun `parse macht aus einem Job-Fehler eine DashboardException`() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(202).setBody("""{"ok":true,"jobId":"j1"}"""))
    server.enqueue(MockResponse().setBody("""{"ok":true,"status":"error","error":"kein Rezept"}"""))

    val e = assertFailsWith<DashboardException> { client(server).parse("x", null) }
    assertTrue(e.message!!.contains("kein Rezept"))
}
```

Damit die Tests nicht sekundenlang schlafen, bekommt `DashboardClient` einen Konstruktor-Parameter `pollDelayMs: Long = 2_000`, den die Testhilfe `client(server)` auf `0` setzt.

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: FAIL — `parse` schickt kein `async`, `pollDelayMs` existiert nicht.

- [ ] **Step 3: `parse` auf Polling umbauen**

In `DashboardClient.kt`:

```kotlin
    suspend fun parse(text: String, sourceUrl: String?): RecipeDraft = withContext(Dispatchers.IO) {
        val start = post("/api/recipes/parse", buildJsonObject {
            put("text", text)
            put("sourceUrl", sourceUrl)
            put("async", true)
        })
        val jobId = start["jobId"]?.jsonPrimitive?.contentOrNull
            ?: throw DashboardException("Antwort ohne Job-Id")

        val deadline = System.currentTimeMillis() + MAX_POLL_MS
        while (true) {
            val job = get("/api/recipes/parse?job=$jobId")
            when (job["status"]?.jsonPrimitive?.contentOrNull) {
                "done" -> return@withContext toDraft(
                    job["recipe"]?.jsonObject ?: throw DashboardException("Antwort ohne Rezept")
                )
                "error" -> throw DashboardException(
                    job["error"]?.jsonPrimitive?.contentOrNull ?: "Import fehlgeschlagen."
                )
            }
            if (System.currentTimeMillis() > deadline) {
                throw DashboardException("Import dauert zu lange — bitte erneut versuchen.")
            }
            delay(pollDelayMs)
        }
        @Suppress("UNREACHABLE_CODE") throw DashboardException("unerreichbar")
    }
```

Dazu `private const val MAX_POLL_MS = 150_000L` auf Dateiebene und eine `get(path)`-Funktion neben `post`, die dieselben Header setzt (Bearer, optional die beiden Cloudflare-Header) und dieselbe Fehlerbehandlung nutzt. Die HTTP-Logik aus `post` dafür in eine gemeinsame private Funktion ziehen, die einen fertigen `Request.Builder` entgegennimmt — nicht duplizieren.

Der `404` auf eine abgelaufene Job-Id trägt sich von selbst: `post`/`get` werfen bei non-2xx bereits mit der Servermeldung „Job unbekannt oder abgelaufen."

- [ ] **Step 4: Verstrichene Zeit anzeigen**

In `ShareActivity.kt` `ImportState.Working` zu `data class Working(val seconds: Int = 0)` machen und während `runImport` einen Zähler mitlaufen lassen, der den Zustand jede Sekunde erneuert. Die `Working`-Ansicht zeigt den Wert unter dem Spinner, z.B. „Rezept wird gelesen… 23 s". Alle Stellen, die `ImportState.Working` als `data object` verwenden, zeigt der Compiler.

- [ ] **Step 5: Tests laufen lassen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt android/app/src/main/java/de/dml/rezeptimporter/ui/ShareActivity.kt android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt
git commit -m "feat: Import als Job starten und pollen statt zu blockieren"
```

---

### Task 9: Kategorie-Auswahl im App-Preview

**Files:**
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/domain/RecipeDraft.kt`
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt` (`toDraft`, `toJson`)
- Modify: `android/app/src/main/java/de/dml/rezeptimporter/ui/PreviewScreen.kt`
- Test: `android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt`

**Interfaces:**
- Consumes: das `category`-Feld der Serverantwort aus Task 5.
- Produces: `RecipeDraft.category: String`.

- [ ] **Step 1: Den fehlschlagenden Test schreiben**

```kotlin
@Test
fun `parse liest die Kategorie, save schickt sie zurueck`() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(202).setBody("""{"ok":true,"jobId":"j1"}"""))
    server.enqueue(
        MockResponse().setBody("""{"ok":true,"status":"done","recipe":{"name":"Kekse","category":"suesses","steps":[],"ingredients":[]}}""")
    )
    val draft = client(server).parse("x", null)
    assertEquals("suesses", draft.category)

    server.enqueue(MockResponse().setBody("""{"ok":true,"id":"1","name":"Kekse"}"""))
    client(server).save(draft)
    server.takeRequest(); server.takeRequest()
    assertTrue(server.takeRequest().body.readUtf8().contains("\"category\":\"suesses\""))
}

@Test
fun `unbekannte Kategorie wird zur Hauptmahlzeit`() = runBlocking {
    server.enqueue(MockResponse().setResponseCode(202).setBody("""{"ok":true,"jobId":"j1"}"""))
    server.enqueue(
        MockResponse().setBody("""{"ok":true,"status":"done","recipe":{"name":"X","category":"nachtisch","steps":[],"ingredients":[]}}""")
    )
    assertEquals("hauptmahlzeit", client(server).parse("x", null).category)
}
```

- [ ] **Step 2: Test laufen lassen, Fehlschlag bestätigen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: FAIL — `category` existiert nicht.

- [ ] **Step 3: Feld und Abbildung ergänzen**

In `RecipeDraft.kt`, neben `vegetarian`:

```kotlin
    /** "hauptmahlzeit" | "snack" | "suesses"; vom Server geraten, hier korrigierbar. */
    val category: String = "hauptmahlzeit",
```

In `DashboardClient.kt` auf Dateiebene:

```kotlin
private val CATEGORIES = listOf("hauptmahlzeit", "snack", "suesses")

private fun normalizeCategory(raw: String?): String =
    if (raw in CATEGORIES) raw!! else "hauptmahlzeit"
```

In `toDraft`: `category = normalizeCategory(r["category"]?.jsonPrimitive?.contentOrNull),`
In `toJson`: `put("category", draft.category)`

- [ ] **Step 4: Auswahl im Preview einbauen**

In `PreviewScreen.kt` unter der Zeile mit dem Vegetarisch-Häkchen eine Reihe aus drei auswählbaren Chips (`FilterChip`), beschriftet „Hauptmahlzeit", „Snack", „Süßes". Ein Klick setzt `draft = draft.copy(category = …)`, der aktive Chip ist `selected`.

- [ ] **Step 5: Tests laufen lassen**

```bash
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: `BUILD SUCCESSFUL`.

- [ ] **Step 6: Commit**

```bash
git add android/app/src/main/java/de/dml/rezeptimporter/domain/RecipeDraft.kt android/app/src/main/java/de/dml/rezeptimporter/dashboard/DashboardClient.kt android/app/src/main/java/de/dml/rezeptimporter/ui/PreviewScreen.kt android/app/src/test/java/de/dml/rezeptimporter/dashboard/DashboardClientTest.kt
git commit -m "feat: Kategorie im Preview waehlbar"
```

---

### Task 10: Deploy, Migration und Messung

Erst hier verlässt irgendetwas den Rechner.

**Files:** keine Codeänderung; Ergebnis ist ein Messwert und ein laufendes System.

**Interfaces:**
- Consumes: alles vorherige.
- Produces: eine belegte Zahl für den Tempo-Gewinn.

- [ ] **Step 1: Alle Tests beider Repos laufen lassen**

```bash
cd web && node_modules/.bin/vitest run
cd android && ./gradlew :app:testDebugUnitTest --console=plain
```

Erwartet: beides grün. Nicht weitermachen, solange etwas rot ist.

- [ ] **Step 2: Vergleichswert VOR dem Deploy holen**

Auf dem Tablet, mit dem alten Stand, dieselbe Rezeptkarte durchschicken und die Zeit notieren:

```bash
ssh -p 8022 u0_a353@192.168.178.91 'cd ~/haushalts-dashboard; TOK=$(grep -oE "^RECIPE_IMPORT_TOKEN=.*" web/.env | cut -d= -f2-); curl -s -o /dev/null -w "vorher: %{time_total}s\n" -m 240 http://localhost:3001/api/recipes/parse -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" --data-binary @/data/data/com.termux/files/home/ocr.json'
```

Die Datei `~/ocr.json` liegt vom 2026-09-01 dort. Referenzwert von damals: **42 s**.

- [ ] **Step 3: Deployen**

Branch `rezept-tempo-kategorien` nach `main` mergen und pushen, dann am Tablet **in einer einzigen SSH-Sitzung** (abgetrennte Prozesse sterben bei wackligem SSH-Ende):

```
git pull --ff-only
npm install
node_modules/.bin/prisma generate      # NICHT npx
```

- [ ] **Step 4: Spalte in der Tablet-DB anlegen**

Aus `~/haushalts-dashboard/web` heraus, damit `require("better-sqlite3")` auflöst:

```bash
node -e "const db=require('better-sqlite3')('dev.db'); db.exec(\"ALTER TABLE Recipe ADD COLUMN category TEXT NOT NULL DEFAULT 'hauptmahlzeit'\"); console.log('ok')"
```

- [ ] **Step 5: Gegenprüfen, dass der Client die Spalte kennt**

```bash
grep -c "category" web/src/generated/prisma/models/Recipe.ts
```

Erwartet: größer 0. Ist das Ergebnis 0, war `prisma generate` wirkungslos — der Server liefe danach mit veraltetem Client weiter und die Kategorie fehlte zur Laufzeit, ohne dass irgendetwas rot wird.

- [ ] **Step 6: Bauen und neu starten**

```
npx next build --webpack     # Turbopack hat keine Bindings auf android/arm64
~/restart-dashboard.sh
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3001/mobile/meals
```

Erwartet: beide `200`. Die Startseite allein genügt als Probe nicht — sie liest die Rezept-Tabelle gar nicht, während `/mobile/meals` den Essensplan lädt und damit die neue Spalte und den frisch generierten Prisma-Client trifft; mit `typescript.ignoreBuildErrors: true` liefen sonst Build und Smoke-Test grün, obwohl der Essensplan beim ersten Öffnen durch den Nutzer bricht.

- [ ] **Step 7: Messwert NACH dem Deploy holen**

Denselben Befehl wie in Step 2 laufen lassen. Beide Zahlen im Abschlussbericht nennen — vorher, nachher, Differenz in Prozent. Keine Schätzung, keine Rundung ins Erfreuliche.

- [ ] **Step 8: Asynchronen Weg über Cloudflare prüfen**

```bash
ssh -p 8022 u0_a353@192.168.178.91 'cd ~/haushalts-dashboard; TOK=$(grep -oE "^RECIPE_IMPORT_TOKEN=.*" web/.env | cut -d= -f2-); JOB=$(curl -s http://localhost:3001/api/recipes/parse -X POST -H "Content-Type: application/json" -H "Authorization: Bearer $TOK" -d "{\"text\":\"250g Nudeln, 120g Pesto. Nudeln kochen, Pesto unterruehren.\",\"async\":true}" | grep -oE "\"jobId\":\"[^\"]+\"" ); echo "$JOB"'
```

Danach mit der Id per `GET ...?job=<id>` pollen, bis `done` kommt. Jeder einzelne Aufruf muss im Millisekundenbereich liegen — das ist der eigentliche Zweck des Umbaus.

- [ ] **Step 9: APK bauen und bereitstellen**

```bash
cd android && ./gradlew assembleDebug --console=plain
```

Signatur gegenprüfen (muss `CN=ObsiDine Debug` sein, sonst ist ein Drüberinstallieren unmöglich und die gespeicherten Zugangsdaten wären verloren):

```bash
"$LOCALAPPDATA/Android/Sdk/build-tools/35.0.0/apksigner.bat" verify --print-certs android/app/build/outputs/apk/debug/app-debug.apk
```

Dann per `scp` nach `~/haushalts-dashboard/web/public/obsididine.apk` auf dem Tablet und die SHA256 beider Dateien vergleichen.

- [ ] **Step 10: Echten Import über die App fahren**

Ein Instagram-Rezept teilen. Prüfen: Fortschrittsanzeige läuft, Kategorie steht im Preview und ist umstellbar, Speichern legt das Rezept mit der richtigen Kategorie an, ein Snack taucht anschließend **nicht** im Wochenplan-Entwurf auf.

---

## Selbstprüfung des Plans

**Spec-Abdeckung:** Prompt-Kürzung → Task 5. Asynchroner Import (Protokoll, Job-Speicher, App) → Tasks 6, 7, 8. Kategorien (Schema, Migration, Filterstellen, Oberflächen, Import-Weg) → Tasks 1, 2, 3, 4, 5, 9. Fehlerfälle → Tasks 6 (TTL, unbekannte Id), 7 (404, Fehler im Job), 8 (Obergrenze), 1 und 5 (Rückfall auf `hauptmahlzeit`). Messung → Task 10, Steps 2 und 7. Keine Lücke.

**Typkonsistenz:** `normalizeCategory` heißt in `data.ts` und in `DashboardClient.kt` gleich, verhält sich gleich und wird in Tasks 1, 5 und 9 identisch verwendet. `RecipeCategory` kommt durchgehend aus `@/lib/domain`. Der Formular-`RecipeDraft` (`recipeForm.ts`, Task 4) und der App-`RecipeDraft` (Kotlin, Task 9) tragen denselben Namen, sind aber verschiedene Typen in verschiedenen Repos — in Task 4 und Task 9 jeweils benannt.
