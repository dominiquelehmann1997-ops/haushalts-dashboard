-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_MealPlanEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "date" DATETIME NOT NULL,
    "reason" TEXT,
    "extraPortion" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'active',
    "recipeId" TEXT,
    CONSTRAINT "MealPlanEntry_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_MealPlanEntry" ("date", "extraPortion", "id", "reason", "recipeId", "status") SELECT "date", "extraPortion", "id", "reason", "recipeId", "status" FROM "MealPlanEntry";
DROP TABLE "MealPlanEntry";
ALTER TABLE "new_MealPlanEntry" RENAME TO "MealPlanEntry";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
