import "dotenv/config";

import { prisma } from "../src/lib/db";
import { syncIngredientsToShopping } from "../src/lib/services/shoppingSync";

// Regeneriert die Rezept-Einkaufs-Items aus dem aktuellen Wochenplan
// (source:"recipe") — füllt u.a. die Mengenangabe (spec) neu. Manuelle Items
// bleiben unberührt. Gefahrlos wiederholbar (wipe+recreate des Rezept-Anteils).
//
// Aufruf: npm run sync:shopping
async function main() {
  const names = await syncIngredientsToShopping();
  console.log(`✓ ${names.length} Rezept-Zutaten synchronisiert:`);
  for (const name of names) console.log(`  • ${name}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
