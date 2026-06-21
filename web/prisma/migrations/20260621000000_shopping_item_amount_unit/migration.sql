-- AlterTable: Mengenangaben auf ShoppingItem (beide Spalten nullable, kein Backfill nötig)
ALTER TABLE "ShoppingItem" ADD COLUMN "amount" TEXT;
ALTER TABLE "ShoppingItem" ADD COLUMN "unit" TEXT;
