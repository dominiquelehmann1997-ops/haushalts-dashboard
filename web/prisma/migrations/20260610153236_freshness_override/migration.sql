-- CreateTable
CREATE TABLE "FreshnessOverride" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "freshness" TEXT NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "FreshnessOverride_name_key" ON "FreshnessOverride"("name");
