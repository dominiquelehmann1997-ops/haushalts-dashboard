-- Recipe bekommt die Felder, die bisher nur im Vault-Markdown lagen
-- (Kochansicht + Filter), Ingredient eine stabile Sortierung.
--
-- HAND-EDIT: Prisma hätte "updatedAt" (NOT NULL, kein Default) beim Kopieren
-- weggelassen — das schlägt auf einer befüllten prod.db fehl. Bestandszeilen
-- bekommen daher CURRENT_TIMESTAMP für createdAt/updatedAt.
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "Ingredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ingredient" ("amount", "id", "name", "recipeId", "unit") SELECT "amount", "id", "name", "recipeId", "unit" FROM "Ingredient";
DROP TABLE "Ingredient";
ALTER TABLE "new_Ingredient" RENAME TO "Ingredient";
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "simple" BOOLEAN NOT NULL DEFAULT true,
    "reheatable" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT,
    "rating" TEXT NOT NULL DEFAULT 'ok',
    "slug" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "vaultFile" TEXT,
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
INSERT INTO "new_Recipe" ("archived", "id", "name", "rating", "reheatable", "simple", "slug", "tags", "vaultFile", "createdAt", "updatedAt") SELECT "archived", "id", "name", "rating", "reheatable", "simple", "slug", "tags", "vaultFile", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
