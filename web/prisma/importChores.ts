import "dotenv/config";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";
import { importChores } from "../src/lib/repositories/choreImport";

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  try {
    const summary = await importChores(prisma, today);
    console.log(`Chore-Import fertig: ${summary.created} neu, ${summary.updated} aktualisiert.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
