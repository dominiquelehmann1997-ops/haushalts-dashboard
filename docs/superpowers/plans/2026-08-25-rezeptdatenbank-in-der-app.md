# Rezeptdatenbank in der App — Obsidian ablösen

**Datum:** 2026-08-25
**Branch:** `feat/rezept-db` (Worktree `haushalts-dashboard-rezepte`)
**Status:** Phasen 1–7 erledigt; offen ist nur noch der Cutover auf dem Tablet

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

## ⚠️ Das Risiko, das Phase 6 geschlossen hat

**Bis 2026-08-25 gab es kein Backup der Tablet-DB.** In `scripts/` stand nichts
dergleichen; es stand 2026-06 im Umsetzungsplan und wurde nie gebaut. Der Vault
war faktisch die einzige Sicherung der Rezepte.

Seit Phase 6 sichert `scripts/tablet-backup.sh` beides — DB-Snapshot und
lesbaren Export. **Der Vault-Ordner darf trotzdem erst weg, wenn das Backup auf
dem Tablet nachweislich gelaufen ist** (siehe „Cutover" unten); ein Backup, von
dem man nur glaubt, dass es läuft, ist keins.

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

### Phase 4 — Detailseite, Portionsrechner, Bearbeiten

- Detailseite `rezepte/[id]` mit Kennzahlen-Chips, Bild, Zubereitung, Notizen
  und Quelle. `RecipePortionList` (Client) skaliert die Zutaten über
  `scaleIngredients`; **kcal bleibt kcal pro Portion und wird nicht
  mitskaliert.** Ohne Portionsangabe bleibt der Regler weg, statt zu raten.
- `RecipeDetailActions` — Bewertung (optimistisch) und Löschen in zwei
  Schritten. Ist das Rezept noch verplant, wird es nur archiviert; die Seite
  sagt das auch.
- `RecipeEditor` für Anlegen (`rezepte/neu`) und Bearbeiten
  (`rezepte/[id]/bearbeiten`), verdrahtet per `startTransition`. Der
  Formularzustand ist ein `RecipeDraft` aus lauter Strings; die Umrechnerei
  nach `RecipeInput` steht rein und getestet in `services/recipeForm.ts`
  (`draftToInput`, `parseTagInput`, `splitSteps`, `moveItem`).
- Actions: `createRecipeAction`, `updateRecipeAction`, `deleteRecipeAction`,
  `setRecipeRatingAction`. `revalidateRecipes()` nimmt zusätzlich zum
  Dashboard das dynamische Segment `rezepte/[id]` mit — in der festen Pfadliste
  von `revalidateDashboard` ist es nicht abgedeckt.
- **Ein Import-Weg für beides:** `upsertImportedRecipe(ImportedRecipe)` im
  Repository. Dedupe über `sourceUrl`, sonst über `slug`; archivierte Rezepte
  werden wiederbelebt statt dupliziert; `rating`, `notes` und `imagePath`
  überleben den Re-Import (die Quelle weiß nichts davon). Der Slug bleibt, was
  er beim ersten Import war, und wird nur vergeben, wenn ihn nicht schon ein
  anderes Rezept trägt (`slug` ist unique).
- `importRecipeUrlAction` schreibt darüber direkt in die DB;
  `importRecipeFromUrl` holt nur noch und parst. `importedRecipeToVaultMarkdown`,
  `findExistingRecipeFile` und `fileNameFromRecipe` sind raus, ebenso
  `ImportedRecipe.id` → jetzt `slug`. `npm run import:recipe` läuft mit.
- `acceptRecipeIdeaAction` nimmt denselben Weg über `recipeIdeaToImported`;
  `saveRecipeIdeaToVault`/`recipeIdeaToVaultMarkdown` sind raus. Damit sind
  auch die zwei Altlasten erledigt: kein bedingungsloses Überschreiben mehr,
  und der Slug kommt aus `slugFromName` statt aus `slugFromFilename`
  („Gemüse…" wurde dort zu `gem-se-…`).
- Dish-Namen in `MealWeekList.tsx` und `widgets.tsx` verlinken auf
  `/mobile/meals/rezepte/<recipeId>` statt auf `obsidian://`. `Meal.obsidianUrl`
  wird nirgends mehr gelesen — das Feld selbst fliegt in Phase 7.

**Stand:** 563 Tests grün, `typecheck`, `lint` und `next build` sauber.
Detailseite, Editor und die Umlaut-Suche gegen den Dev-Server auf 3001
gegengeprüft.

### Phase 5 — Bilder

- Env `RECIPE_IMAGE_DIR`, in `.env.example` dokumentiert. Muss außerhalb des
  Repos liegen — ein Redeploy nähme die Bilder sonst mit. Ohne die Variable
  bleiben Rezepte schlicht bildlos, nichts bricht.
- `pickImageUrl` (rein, getestet) liest `schema.image` in allen Varianten:
  String, Liste, `ImageObject` mit `url`/`contentUrl`, verschachtelt. Relative
  Pfade werden gegen die Seiten-URL aufgelöst, `data:`-Platzhalter abgewiesen.
  Landet als `ImportedRecipe.imageUrl`.
- `src/lib/services/recipeImage.ts` lädt das Bild **einmalig** (ein erneuter
  Import lässt ein vorhandenes Bild in Ruhe, wie Bewertung und Notizen) und
  legt es unter `RECIPE_IMAGE_DIR` ab. Fehlschlag ist nie fatal.
  - **Der Dateityp kommt aus den Magic Bytes, nicht aus `Content-Type`:**
    Rezeptseiten liefern gerne eine HTML-Fehlerseite mit Status 200 und
    falschem Header. Was sich nicht als jpg/png/gif/webp/avif lesen lässt,
    wird nicht gespeichert.
  - `readCapped` bricht bei 3 MB ab, statt erst alles in den Speicher zu laden
    (`Content-Length` fehlt bei Chunked-Antworten oder lügt).
  - **Der Dateiname kommt aus dem gespeicherten Slug, nicht aus dem der
    Quelle** — der Upsert vergibt den Slug nur, wenn er frei ist; ein Rezept
    ohne Slug bekommt seine id. Sonst könnten sich zwei Rezepte dieselbe
    Bilddatei überschreiben.
- `src/app/api/recipe-image/[file]/route.ts` liefert aus `RECIPE_IMAGE_DIR`
  aus. `isSafeImageFile` lässt nur Namen durch, die der Downloader selbst
  vergibt (`^[a-z0-9][a-z0-9-]*\.(jpg|png|gif|webp|avif)$`) — kein `..`, keine
  Pfadtrenner. Alles Abgewiesene wird zu 404, nicht zu 403: ob eine Datei
  existiert, geht den Aufrufer nichts an.
- `setRecipeImage` im Repository; `imageUrlOf()` erzeugte die URLs schon.

**Stand:** 587 Tests grün, `typecheck`, `lint` und `next build` sauber. Gegen
den Dev-Server geprüft: Bild kommt byte-identisch mit `image/png` zurück,
Detailseite und Liste zeigen es, und `..%2f..%2f.env`, `%2e%2e%2f…`,
`.js`-Endungen sowie Großschreibung liefern alle 404.

---

### Phase 6 — Backup (`cecfc05`)

- `web/src/lib/services/recipeMarkdown.ts` (rein, getestet): Rezept → Datei.
  `matter.stringify`, leere Felder fallen weg statt als `null` dazustehen.
  **Deterministisch** — kein Exportzeitpunkt in der Datei; nur so kann der
  Export unveränderte Dateien in Ruhe lassen, statt Obsidian Sync jede Nacht
  den ganzen Ordner neu übertragen zu lassen.
- `assignExportFileNames` löst Namenskollisionen auf: `Recipe.name` ist nicht
  unique, zwei gleichnamige Rezepte dürfen sich keine Datei teilen (zweiter
  weicht auf seine id aus).
- `web/src/lib/repositories/recipeExport.ts` + CLI `npm run export:recipes`.
  Aufgeräumt werden **nur Dateien mit der Signatur `exportedBy`**. Der
  Exportordner darf der alte Vault sein; handgepflegte Notizen dort werden
  gemeldet, nie gelöscht, `_`-Vorlagen gar nicht erst angefasst.
- Archivierte Rezepte kommen mit (`archived: true`) — ein Backup, das
  stillschweigend Daten weglässt, ist keines. Dafür `listAllRecipes`.
- `scripts/tablet-backup.sh`: datierte `prod.db`-Kopie (die neuesten 14
  bleiben) plus Export. Der DB-Pfad wird aus `web/.env` gelesen, nicht fest
  verdrahtet.
  - **`sqlite3 .backup` statt `cp`:** die DB läuft im WAL-Modus und der Server
    schreibt weiter; ein plumpes `cp` erwischt einen zerrissenen Stand.
    Gegenprobe per `quick_check`, Ablage erst nach vollständiger Kopie
    (`.part` → `mv`). Ohne `sqlite3` Fallback auf `cp` inkl. `-wal`/`-shm`.
  - **Rollierend nach Anzahl, nicht nach Alter:** läuft der Job zwei Wochen
    nicht, löscht `find -mtime +14` den letzten Bestand mit weg.
  - **Tagesriegel im Script:** Android lässt periodische Jobs nicht auf eine
    Uhrzeit festnageln und streckt sie im Doze-Modus. Der Job darf also öfter
    feuern (empfohlen: alle 6 h), gesichert wird trotzdem einmal pro Tag.
- `RECIPE_EXPORT_PATH` in `.env.example` dokumentiert, Backup-Abschnitt im
  Haupt-README.

**Stand:** 611 Tests grün, `typecheck` und `lint` sauber. Script end-to-end
gegen die Worktree-`dev.db` gelaufen: Snapshot, Export, zweiter Lauf ohne
Schreibvorgänge, Aufräumen einer verwaisten Datei, 20 Snapshots auf 14
gestutzt, fremde Notiz unangetastet, Fehlerpfad (DB fehlt) mit Exit 1.

### Phase 7 — Obsidian ausgebaut (`b9cc89f`)

- Gelöscht: `recipeVault.ts`, `recipeIngest.ts`, `obsidian.ts`,
  `vaultMigration.ts` (je + Test), `VaultIngestControl.tsx`,
  `prisma/ingestRecipes.ts`, `prisma/migrateVaultToDb.ts`, `ingestVaultAction`,
  die npm-Scripts `import:recipes` und `migrate:vault`.
- `Rating` nach `data.ts` umgezogen (re-exportiert aus `domain.ts`). **Drei**
  Importeure, nicht zwei — `mealWeights.ts` hing auch daran.
- `Meal.obsidianUrl` und `Recipe.vaultFile` raus, Migration
  `20260825154600_drop_recipe_vault_file`. Der `updatedAt`-Trap aus Phase 1
  wiederholt sich nicht: beide Zeitspalten existieren inzwischen als echte
  Spalten mit Werten, Prisma kopiert sie korrekt mit.
- Envs `RECIPE_VAULT_PATH` und `OBSIDIAN_VAULT_NAME` entfallen.
- Doku: `docs/rezept-export-format.md` ersetzt `recipe-vault-schema.md` und
  `recipe-vault-template.md`. `recipe-vault-import-contract.md` und
  `recipe-importer-init-prompt.md` bekommen einen ÜBERHOLT-Vorspann statt
  einer Löschung — sie belegen, warum das Exportformat aussieht wie es
  aussieht. `rezepte-quellen-und-import.md` richtiggestellt (Import schreibt
  in die DB; Bewertung/Notizen/Bild überleben den Re-Import; Web Clipper und
  Recipe Grabber sind kein Weg mehr). Nebenbefund `freshness` mitgenommen.

**Stand:** 572 Tests grün (611 minus die 39 Vault-Tests), `typecheck`, `lint`
und `next build` sauber.

---

## Offen

### Cutover auf dem Tablet

Der Merge deployt nichts. Auf dem Tablet (dort liegt der Vault, nicht auf dem
Windows-Rechner):

```
prisma migrate deploy
prisma generate
npm run migrate:vault      # Report gegen die Anzahl .md im Vault prüfen
npm run build
```

Ohne `migrate:vault` bleiben Zubereitung, Portionen und Nährwerte der
Bestandsrezepte leer. Restart-Hinweis beachten: das dokumentierte
`pkill -f "next start"` trifft Next 16 nicht mehr.

> ⚠️ **Reihenfolge:** `npm run migrate:vault` gibt es nur bis einschließlich
> `cecfc05` (Phase 6). Phase 7 (`b9cc89f`) löscht das Script. Also **erst den
> Cutover fahren, dann Phase 7 ausrollen** — sonst ist die Vault-Übernahme
> nicht mehr möglich und die Bestandsrezepte bleiben unvollständig.

Danach einmalig:

- `RECIPE_EXPORT_PATH` in `web/.env` setzen (darf der alte Vault-Ordner sein).
- `npm run export:recipes` von Hand laufen lassen und den Ordner ansehen.
  Beim ersten Lauf im alten Vault meldet der Export die Altbestände als
  „nicht von uns" — die lassen sich löschen, sobald der Export geprüft ist.
- `scripts/tablet-backup.sh` einhängen (Aufrufzeile im Script-Kopf) und am
  Folgetag nachsehen, ob wirklich ein Snapshot liegt. `termux-job-scheduler`
  braucht die Termux:API-**App**; fehlt sie, hängt der Aufruf still.
- Erst danach den Vault-Ordner als Rezeptquelle aufgeben.

### Nicht gesichert: die Rezeptbilder

`RECIPE_IMAGE_DIR` liegt außerhalb des Repos und außerhalb der DB — das
Backup fasst es nicht an. Verschmerzbar (die Bilder hängen an `sourceUrl` und
sind nachladbar), aber bewusst offen gelassen, nicht übersehen.

---

## Verifikation

Im Worktree (eigene `.env`, eigene `dev.db` — `prod.db` bleibt unberührt):

```
npm run typecheck    # Pflicht: next.config.ts setzt ignoreBuildErrors, der Build faengt nichts
npm run lint
npm test
npm run build
npm run dev          # Port 3001
```

Nach einem Merge mit Schema-Änderungen erst `npx prisma generate` — `src/generated/`
ist gitignored und pro Worktree, sonst hagelt es Typfehler, die wie ein kaputter
Merge aussehen.

Umlaut-Suche im Browser gegenprüfen (`?q=gemüse` **und** `?q=gemuese`) — per
`curl` in Git Bash schlägt das fehl, weil die Shell den Umlaut als Latin-1
kodiert; mit `%C3%BC` funktioniert es, und genau das sendet ein Browser.

Das Backup-Script lässt sich gefahrlos gegen die Worktree-DB laufen lassen —
`RECIPE_EXPORT_PATH` vorher in `web/.env` setzen, sonst bricht der Export-Teil ab:

```
DASHBOARD_BACKUP_DIR=/tmp/backup-probe bash scripts/tablet-backup.sh --force
```
