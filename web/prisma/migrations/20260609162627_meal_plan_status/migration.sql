-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "extraPortion" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recipeId" TEXT NOT NULL,
    CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_MealPlanEntry" ("date", "extraPortion", "id", "reason", "recipeId") SELECT "date", "extraPortion", "id", "reason", "recipeId" FROM "MealPlanEntry";
DROP TABLE "MealPlanEntry";
ALTER TABLE "new_MealPlanEntry" RENAME TO "MealPlanEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
