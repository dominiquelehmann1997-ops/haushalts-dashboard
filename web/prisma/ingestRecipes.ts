import "dotenv/config";

import { prisma } from "../src/lib/db";
import { ingestVault } from "../src/lib/repositories/recipeIngest";

// CLI-Pendant zum VaultIngestControl-Button: liest den Rezepte-Vault
// (RECIPE_VAULT_PATH) und spiegelt ihn in die DB. Nützlich, um den Vault vom
// Laptop/Terminal aus neu einzulesen, ohne das Dashboard zu öffnen.
async function main() {
  const vaultPath = process.env.RECIPE_VAULT_PATH;
  if (!vaultPath) {
    console.error("RECIPE_VAULT_PATH ist nicht gesetzt (web/.env).");
    process.exitCode = 1;
    return;
  }

  try {
    const report = await ingestVault(vaultPath);
    console.log(
      `Rezept-Ingest fertig: ${report.imported} importiert, ${report.archived} archiviert.`,
    );
    if (report.errors.length > 0) {
      console.error("Fehler:\n" + report.errors.map((e) => `  - ${e}`).join("\n"));
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
