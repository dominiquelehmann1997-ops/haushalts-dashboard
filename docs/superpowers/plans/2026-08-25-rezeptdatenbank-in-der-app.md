# Rezeptdatenbank in der App — Obsidian ablösen

**Datum:** 2026-08-25
**Branch:** `feat/rezept-db` (Worktree `haushalts-dashboard-rezepte`)
**Status:** Phasen 1–3 erledigt, Phasen 4–7 offen

## Ziel

Rezepte werden künftig in der App gepflegt statt im Obsidian-Vault. Das kehrt
das bisherige Prinzip „Vault = Wahrheit, DB = Cache" um. Ergebnis: eine
Rezeptseite unter *Essen* mit Volltextsuche, Filtern, Detailseite mit
Portionsrechner und Bild, Anlegen/Bearbeiten in der App — und ein nächtliches,
menschenlesbares Backup.

**Begründung:** Die App ist über den Cloudflare-Tunnel ohnehin von überall
erreichbar; damit war Obsidian Sync der letzte verbliebene Vorteil des Vaults.
Es fällt viel Mechanik weg: Ingest, Orphan-Archivierung, zwei divergierende
Slug-Funktionen, `RECIPE_VAULT_PATH`, `OBSIDIAN_VAULT_NAME`.

## ⚠️ Offenes Risiko bis Phase 6

**Es gibt kein Backup der Tablet-DB.** In `scripts/` steht nichts dergleichen;
es stand 2026-06 im Umsetzungsplan und wurde nie gebaut. Der Vault war faktisch
die einzige Sicherung der Rezepte. Solange Phase 6 nicht steht, ist der Vault
die einzige Kopie — **also den Vault-Ordner bis dahin nicht löschen.**

---

## Erledigt

### Phase 1 — Schema + einmalige Vault-Übernahme (`a856e07`)

- `Recipe` um `servings`, `prepMinutes`, `cookMinutes`, `kcal`, `protein`,
  `steps` (JSON), `notes`, `sourceUrl`, `imagePath`, `createdAt`, `updatedAt`
  erweitert; `Ingredient.sort` für stabile Reihenfolge.
- Migration `20260825104108_recipe_full_fields`. **Handkorrigiert:** Prisma
  hätte `updatedAt` (NOT NULL, kein Default) beim SQLite-Tabellen-Rewrite nicht
  mitkopiert — das schlägt auf einer befüllten `prod.db` fehl. Bestandszeilen
  bekommen `CURRENT_TIMESTAMP`. Gegen eine künstlich befüllte DB verifiziert.
- `parseRecipeMarkdown` liest jetzt zusätzlich Portionen, Zeiten, Nährwerte,
  Quell-URL und die Zubereitung (neue reine Funktion `parseSteps`).
  **Übergangs-Code** — fliegt in Phase 7 mit raus.
- `migrateVaultToDb` (`src/lib/repositories/vaultMigration.ts`) + CLI
  `npm run migrate:vault`. Upsert nach `slug`, damit `MealPlanEntry.recipeId`
  heil bleibt; archiviert nichts, damit App-eigene Rezepte überleben.
- **Cutover:** `ingestVaultIfConfigured()` aus `generatePlanAction` entfernt —
  sonst hätte der Vault App-Änderungen wieder überschrieben.

### Phase 2 — Repository + Such-/Filterlogik (`d239d3e`)

- `src/lib/services/recipeSearch.ts` (rein): `normalizeSearchText` (Umlaut-
  Transliteration, `TRANSLITERATE` aus `recipeImport.ts` wiederverwendet),
  `matchesQuery`, `hasIngredient`, `applyFilters`, `collectTags`.
  In-memory statt SQL — Begründung im Dateikopf.
- `src/lib/repositories/recipes.ts`: `listRecipes(filter)`,
  `listRecipeOptions` (schlank, für die Essensplan-Dropdowns), `getRecipe`,
  `createRecipe`, `updateRecipe`, `deleteRecipe`, `listRecipeTags`,
  `setRecipeRating`.
  **`deleteRecipe` archiviert statt zu löschen, wenn das Rezept noch in einem
  Essensplan hängt** — `MealPlanEntry.recipeId` ist ein Fremdschlüssel.
- DTOs `Recipe`, `RecipeIngredient`, `RecipeFilter`, `RecipeTagCount` in
  `data.ts`, re-exportiert aus `domain.ts`.
- `listRecipes` aus `meals.ts` hierher gezogen (als `listRecipeOptions`).
- Seed-Fixtures um Tags/Zeiten/kcal/Zubereitung erweitert; „Reste" bleibt
  bewusst ohne Angaben.

### Phase 3 — Liste, Suche, Filter (`7f04ddc`)

- Route `/mobile/meals/rezepte`, erreichbar über einen „Rezepte"-Knopf im Kopf
  der Essensplan-Seite. In `DASHBOARD_PATHS` eingetragen.
- `src/lib/recipeFilterParams.ts` (rein, getestet): URL ↔ `RecipeFilter`,
  `toggleTag`, `toggleField`, `withQuery`, `recipesHref`.
  Filterzustand steht in der URL → Zurück-Button und Lesezeichen funktionieren.
- `RecipeFilterChips` sind server-gerenderte `<Link>`s (kein JS nötig),
  `RecipeSearchBar` ist die einzige Client-Komponente (entprellt, 250 ms).
- `portions.ts` (rein, getestet) schon vorbereitet: `scaleAmount`,
  `scaleIngredients`, `clampPortions`. Bereiche wie `2-3` und Textangaben
  bleiben unverändert, statt Zahlen zu erfinden.

**Stand:** 544 Tests grün, `typecheck` und `lint` sauber (die eine
`MENU_HEIGHT`-Warnung ist vorbestehend).

---

## Offen

### Phase 4 — Detailseite, Portionsrechner, Bearbeiten

- `src/app/(mobile)/mobile/meals/rezepte/[id]/page.tsx` — Zutaten, Schritte,
  Zeiten, kcal, Quelle. `dynamic = "force-dynamic"`, `params` ist ein Promise
  (Next 16).
- Portionsregler als Client-Komponente über `scaleIngredients` aus
  `portions.ts` (fertig und getestet). **kcal bleibt kcal *pro Portion* und
  wird nicht mitskaliert.**
- `RecipeEditor.tsx` (`"use client"`) — Formular für alle Felder, Zutatenzeilen
  hinzufügen/entfernen/sortieren. Wiring per `startTransition` (Hausform, siehe
  `NotesEditor.tsx`), nicht `useActionState`.
- Actions in `src/app/actions/recipes.ts` ergänzen: `createRecipeAction`,
  `updateRecipeAction`, `deleteRecipeAction`, `setRecipeRatingAction`.
  Muster: Repository aufrufen → `revalidateDashboard()`. Keine Prisma-Queries
  in Actions.
- **Importer umhängen:** `importRecipeUrlAction` schreibt nicht mehr `.md` +
  Ingest, sondern direkt in die DB (Dedupe über `sourceUrl`, sonst `slug`).
  `ImportedRecipe` (`recipeImport.ts:25-40`) ist bereits exakt die Zielform;
  `importedRecipeToVaultMarkdown` und `findExistingRecipeFile` entfallen.
  → Bis das erledigt ist, verliert ein URL-Import die neuen Felder.
- **Ideen-Generator umhängen:** `acceptRecipeIdeaAction`
  (`src/app/actions/recipeIdeas.ts`) schreibt ebenfalls in die DB statt via
  `saveRecipeIdeaToVault`. Erledigt nebenbei zwei Altlasten: das Ding
  überschreibt Dateien bedingungslos und benutzt `slugFromFilename`, das
  Umlaute zerlegt („Gemüse…" → `gem-se-…`).
- Dish-Namen in `MealWeekList.tsx` und `widgets.tsx` auf
  `/mobile/meals/rezepte/<id>` verlinken statt auf `obsidian://`.

### Phase 5 — Bilder

- Env `RECIPE_IMAGE_DIR` (auf dem Tablet außerhalb des Repos, damit ein
  `.next`-Redeploy die Bilder nicht mitnimmt).
- `src/lib/services/recipeImage.ts` — Bild-URL aus den schema.org-Daten
  (`schema.image`, in `extractRecipeSchema` bereits geparst), einmalig laden,
  Größe begrenzen, als `<slug>.<ext>` ablegen, `imagePath` setzen.
  Fehlschlag ist nicht fatal.
- `src/app/api/recipe-image/[file]/route.ts` — Route-Handler, der aus
  `RECIPE_IMAGE_DIR` ausliefert. **Nicht `public/`.** Dateinamen gegen
  Path-Traversal prüfen (nur `[a-z0-9._-]`, kein `..`).
  `imageUrlOf()` in `recipes.ts` erzeugt diese URLs bereits.

### Phase 6 — Backup (nicht optional, siehe Risiko oben)

- `web/prisma/exportRecipes.ts` (`npm run export:recipes`) — jedes Rezept als
  `.md` mit vollständigem Frontmatter nach `RECIPE_EXPORT_PATH`, Dateiname aus
  `slugFromName`. `matter.stringify` benutzen, kein handgeklöppeltes YAML.
  Verwaiste Exportdateien aufräumen.
- `scripts/tablet-backup.sh` — Export plus datierte `prod.db`-Kopie, 14 Tage
  rollierend. Per `termux-job-scheduler` einhängen (Muster:
  `scripts/tablet-sync.sh`), einmal nächtlich reicht.
- `RECIPE_EXPORT_PATH` darf der alte Vault-Ordner sein — dann sichert Obsidian
  Sync die Exporte weiter mit, ohne dass die App je von dort liest.

### Phase 7 — Obsidian ausbauen

Erst wenn Phase 4 live und die Vault-Übernahme auf dem Tablet gelaufen ist.

Löschen: `src/lib/services/recipeVault.ts` (+ Test),
`src/lib/repositories/recipeIngest.ts` (+ Test),
`src/lib/services/obsidian.ts`,
`src/components/VaultIngestControl.tsx` (schon heute nirgends importiert),
`web/prisma/ingestRecipes.ts`, `web/prisma/migrateVaultToDb.ts`,
`src/lib/repositories/vaultMigration.ts` (+ Test).

Entfernen: `ingestVaultAction`, die npm-Scripts `import:recipes` und
`migrate:vault`, `Recipe.vaultFile` (Migration!), `Meal.obsidianUrl`, die Envs
`RECIPE_VAULT_PATH` und `OBSIDIAN_VAULT_NAME` (auch aus `.env.example`).
`gray-matter` bleibt — der Export braucht es.

Doku nachziehen: `web/README.md` („Rezepte-Vault", „Rezept-Links"),
`docs/rezepte-quellen-und-import.md` (Abschnitt 2 beschreibt den Obsidian-Weg
als Hauptweg), `docs/recipe-vault-schema.md` und `docs/recipe-vault-template.md`
als Export-Format umwidmen oder archivieren.

**Nebenbefund:** `docs/recipe-vault-schema.md` und das Template dokumentieren
ein `freshness`-Feld pro Zutat, das seit der Migration
`20260708135316_..._drop_freshness` nirgends mehr gelesen wird. Die Doku ist
dort schon heute falsch — beim Umschreiben mitnehmen.

---

## Verifikation

Im Worktree (eigene `.env`, eigene `dev.db` — `prod.db` bleibt unberührt):

```
npm run typecheck    # Pflicht: next.config.ts setzt ignoreBuildErrors, der Build faengt nichts
npm run lint
npm test
npm run dev          # Port 3001
```

Umlaut-Suche im Browser gegenprüfen (`?q=gemüse` **und** `?q=gemuese`) — per
`curl` in Git Bash schlägt das fehl, weil die Shell den Umlaut als Latin-1
kodiert; mit `%C3%BC` funktioniert es, und genau das sendet ein Browser.

**Cutover auf dem Tablet** (der Vault liegt dort, nicht auf dem Windows-Rechner):
`prisma migrate deploy` → `generate` → `npm run migrate:vault` → Report gegen
die Anzahl `.md` im Vault prüfen → `npm run build`. Restart-Hinweis beachten:
das dokumentierte `pkill -f "next start"` trifft Next 16 nicht mehr.
