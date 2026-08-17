import "dotenv/config";

import { prisma } from "../src/lib/db";
import { ingestVault } from "../src/lib/repositories/recipeIngest";
import { importRecipeFromUrl } from "../src/lib/services/recipeImport";

// Rezept-Import per Link: holt eine oder mehrere Rezeptseiten, schreibt sie als
// vertragskonforme `.md` in den Vault (RECIPE_VAULT_PATH) und spiegelt den Vault
// anschließend in die DB.
//
//   npm run import:recipe -- https://www.chefkoch.de/rezepte/...
//
// Mehrere Links auf einmal sind erlaubt. Ein fehlgeschlagener Link stoppt die
// anderen nicht.
async function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith("-"));
  const vaultPath = process.env.RECIPE_VAULT_PATH;

  if (!vaultPath) {
    console.error("RECIPE_VAULT_PATH ist nicht gesetzt (web/.env).");
    process.exitCode = 1;
    return;
  }
  if (urls.length === 0) {
    console.error("Aufruf: npm run import:recipe -- <rezept-url> [weitere-urls]");
    process.exitCode = 1;
    return;
  }

  let ok = 0;
  try {
    for (const url of urls) {
      try {
        const { recipe, file, updated } = await importRecipeFromUrl(url, vaultPath);
        const kcal = recipe.kcal !== null ? `, ${recipe.kcal} kcal/Portion` : "";
        console.log(
          `${updated ? "↻ aktualisiert" : "✓ neu"}: ${recipe.name} ` +
            `(${recipe.ingredients.length} Zutaten${kcal}) → ${file}`,
        );
        ok += 1;
      } catch (error) {
        console.error(`✗ ${url}: ${error instanceof Error ? error.message : error}`);
        process.exitCode = 1;
      }
    }

    if (ok > 0) {
      const report = await ingestVault(vaultPath);
      console.log(
        `Vault eingelesen: ${report.imported} Rezepte, ${report.archived} archiviert.`,
      );
      if (report.errors.length > 0) {
        console.error("Ingest-Fehler:\n" + report.errors.map((e) => `  - ${e}`).join("\n"));
        process.exitCode = 1;
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
