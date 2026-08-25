import "dotenv/config";

import { prisma } from "../src/lib/db";
import { exportRecipes } from "../src/lib/repositories/recipeExport";

// BACKUP: schreibt jedes Rezept als Markdown-Datei nach RECIPE_EXPORT_PATH.
//
//   npm run export:recipes
//
// Läuft nächtlich über scripts/tablet-backup.sh, zusammen mit der datierten
// prod.db-Kopie. Beliebig oft ausführbar: unveränderte Rezepte lassen ihre
// Datei in Ruhe.
//
// Die DB ist und bleibt die Wahrheit — hier wird nur geschrieben, nie gelesen.
async function main() {
  const targetPath = process.env.RECIPE_EXPORT_PATH;
  if (!targetPath) {
    console.error("RECIPE_EXPORT_PATH ist nicht gesetzt (web/.env).");
    process.exitCode = 1;
    return;
  }

  try {
    const report = await exportRecipes(targetPath);
    console.log(
      `Rezept-Export nach ${targetPath}: ${report.written} geschrieben, ` +
        `${report.unchanged} unverändert, ${report.removed.length} verwaist entfernt.`,
    );

    // Fremde .md sind der Normalfall, wenn der Export in den alten Vault
    // schreibt: die Altbestände von vor dem Cutover. Sie werden nicht
    // angefasst — wer sie loswerden will, löscht sie selbst.
    if (report.foreign.length > 0) {
      const shown = report.foreign.slice(0, 10);
      console.log(
        `\nNicht von uns, unangetastet (${report.foreign.length}):\n` +
          shown.map((f) => `  - ${f}`).join("\n") +
          (report.foreign.length > shown.length
            ? `\n  … und ${report.foreign.length - shown.length} weitere`
            : ""),
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
