import "dotenv/config";

import { prisma } from "../src/lib/db";
import { migrateVaultToDb } from "../src/lib/repositories/vaultMigration";

// EINMALIGE ÜBERNAHME des Obsidian-Rezepte-Vaults in die DB (RECIPE_VAULT_PATH).
// Danach ist die DB die Wahrheit — bearbeitet wird in der App, der Vault wird
// nur noch als Backup beschrieben.
//
//   npm run migrate:vault
//
// Mehrfach ausführbar, aber nach dem Cutover NICHT mehr aufrufen: ein erneuter
// Lauf überschreibt App-Änderungen mit dem Stand aus dem Vault.
async function main() {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    console.error("RECIPE_VAULT_PATH ist nicht gesetzt (web/.env).");
    process.exitCode = 1;
    return;
  }

  try {
    const report = await migrateVaultToDb(vaultPath);
    console.log(
      `Vault-Übernahme fertig: ${report.created} neu, ${report.updated} aktualisiert.`,
    );
    if (report.withoutSteps.length > 0) {
      console.log(
        `\nOhne Zubereitung (${report.withoutSteps.length}) — in der App nachtragen:\n` +
          report.withoutSteps.map((n) => `  - ${n}`).join("\n"),
      );
    }
    if (report.errors.length > 0) {
      console.error("\nFehler:\n" + report.errors.map((e) => `  - ${e}`).join("\n"));
      process.exitCode = 1;
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
