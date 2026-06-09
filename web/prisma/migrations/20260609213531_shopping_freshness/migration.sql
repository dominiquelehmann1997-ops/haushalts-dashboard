-- AlterTable
ALTER TABLE "Ingredient" ADD COLUMN "category" TEXT;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_ShoppingItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "text" TEXT NOT NULL,
    "meal" BOOLEAN NOT NULL DEFAULT false,
    "source" TEXT NOT NULL DEFAULT 'manual',
    "recipeRef" TEXT,
    "category" TEXT,
    "pushed" BOOLEAN NOT NULL DEFAULT false,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_ShoppingItem" ("createdAt", "done", "id", "meal", "recipeRef", "source", "text") SELECT "createdAt", "done", "id", "meal", "recipeRef", "source", "text" FROM "ShoppingItem";
DROP TABLE "ShoppingItem";
ALTER TABLE "new_ShoppingItem" RENAME TO "ShoppingItem";
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
