/*
  Warnings:

  - You are about to drop the `FreshnessOverride` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `category` on the `Ingredient` table. All the data in the column will be lost.
  - You are about to drop the column `category` on the `ShoppingItem` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "FreshnessOverride_name_key";

-- AlterTable
ALTER TABLE "MealPlanEntry" ADD COLUMN "ingredientsPushedAt" DATETIME;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "FreshnessOverride";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "amount" TEXT,
    "unit" TEXT,
    CONSTRAINT "Ingredient_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_Ingredient" ("amount", "id", "name", "recipeId", "unit") SELECT "amount", "id", "name", "recipeId", "unit" FROM "Ingredient";
DROP TABLE "Ingredient";
ALTER TABLE "new_Ingredient" RENAME TO "Ingredient";
CREATE TABLE "new_ShoppingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "meal" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recipeRef" TEXT,
    "spec" TEXT,
    "pushed" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ShoppingItem" ("createdAt", "done", "id", "meal", "pushed", "recipeRef", "source", "spec", "text") SELECT "createdAt", "done", "id", "meal", "pushed", "recipeRef", "source", "spec", "text" FROM "ShoppingItem";
DROP TABLE "ShoppingItem";
ALTER TABLE "new_ShoppingItem" RENAME TO "ShoppingItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
