-- Recipe.vaultFile fällt weg: der Obsidian-Deeplink hatte mit dem Vault-Ausbau
-- keinen Leser mehr (Meal.obsidianUrl ist raus, Gerichte verlinken auf die
-- Rezept-Detailseite der App).
--
-- GEPRÜFT: SQLite kann keine Spalte löschen, Prisma schreibt die Tabelle also
-- neu. Anders als bei 20260825104108 kopiert es diesmal createdAt/updatedAt
-- korrekt mit — beide sind jetzt echte Spalten mit Werten, kein Hand-Edit
-- nötig. Zutaten und Essensplan-Einträge hängen per Fremdschlüssel an
-- Recipe.id, die bleibt unverändert.

/*
  Warnings:

  - You are about to drop the column `vaultFile` on the `Recipe` table. All the data in the column will be lost.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "simple" BOOLEAN NOT NULL DEFAULT true,
    "reheatable" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "rating" TEXT NOT NULL DEFAULT 'ok',
    "slug" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "servings" INTEGER,
    "prepMinutes" INTEGER,
    "cookMinutes" INTEGER,
    "kcal" INTEGER,
    "protein" INTEGER,
    "steps" TEXT,
    "notes" TEXT,
    "sourceUrl" TEXT,
    "imagePath" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_Recipe" ("archived", "cookMinutes", "createdAt", "id", "imagePath", "kcal", "name", "notes", "prepMinutes", "protein", "rating", "reheatable", "servings", "simple", "slug", "sourceUrl", "steps", "tags", "updatedAt") SELECT "archived", "cookMinutes", "createdAt", "id", "imagePath", "kcal", "name", "notes", "prepMinutes", "protein", "rating", "reheatable", "servings", "simple", "slug", "sourceUrl", "steps", "tags", "updatedAt" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
