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
    "archived" BOOLEAN NOT NULL DEFAULT false
);
INSERT INTO "new_Recipe" ("id", "name", "reheatable", "simple", "tags") SELECT "id", "name", "reheatable", "simple", "tags" FROM "Recipe";
DROP TABLE "Recipe";
ALTER TABLE "new_Recipe" RENAME TO "Recipe";
CREATE UNIQUE INDEX "Recipe_slug_key" ON "Recipe"("slug");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
