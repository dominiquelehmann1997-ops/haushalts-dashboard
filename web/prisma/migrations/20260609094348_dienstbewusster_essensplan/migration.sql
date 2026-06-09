-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "extraPortion" BOOLEAN NOT NULL DEFAULT false,
    "recipeId" TEXT NOT NULL,
    CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MealPlanEntry" ("date", "id", "recipeId") SELECT "date", "id", "recipeId" FROM "MealPlanEntry";
DROP TABLE "MealPlanEntry";
ALTER TABLE "new_MealPlanEntry" RENAME TO "MealPlanEntry";
CREATE TABLE "new_Recipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "simple" BOOLEAN NOT NULL DEFAULT true,
    "reheatable" BOOLEAN NOT NULL DEFAULT false,
    "tags" TEXT
);
INSERT INTO "new_Recipe" ("id", "name", "simple", "tags") SELECT "id", "name", "simple", "tags" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
