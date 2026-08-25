import "dotenv/config";

import { prisma } from "../src/lib/db";
import { upsertImportedRecipe } from "../src/lib/repositories/recipes";
import { attachRecipeImage } from "../src/lib/services/recipeImage";
import { importRecipeFromUrl } from "../src/lib/services/recipeImport";

// Rezept-Import per Link: holt eine oder mehrere Rezeptseiten und legt sie im
// Rezeptbuch (DB) an — bzw. aktualisiert das bestehende Rezept, wenn Quell-URL
// oder Slug schon bekannt sind.
//
//   npm run import:recipe -- https://www.chefkoch.de/rezepte/...
//
// Mehrere Links auf einmal sind erlaubt. Ein fehlgeschlagener Link stoppt die
// anderen nicht.
async function main() {
  const urls = process.argv.slice(2).filter((a) => !a.startsWith("-"));

  if (urls.length === 0) {
    console.error("Aufruf: npm run import:recipe -- <rezept-url> [weitere-urls]");
    process.exitCode = 1;
    return;
  }

  try {
    for (const url of urls) {
      try {
        const recipe = await importRecipeFromUrl(url);
        const { id, updated } = await upsertImportedRecipe(recipe);
        const image = await attachRecipeImage(id, recipe.imageUrl);
        const kcal = recipe.kcal !== null ? `, ${recipe.kcal} kcal/Portion` : "";
        console.log(
          `${updated ? "↻ aktualisiert" : "✓ neu"}: ${recipe.name} ` +
            `(${recipe.ingredients.length} Zutaten${kcal}${image ? ", Bild" : ""}) → ${id}`,
        );
      } catch (error) {
        console.error(`✗ ${url}: ${error instanceof Error ? error.message : error}`);
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
