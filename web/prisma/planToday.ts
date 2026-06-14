import "dotenv/config";

import { prisma } from "../src/lib/db";
import { planDueTasks } from "../src/lib/services/planning";

// Verteilt die heute (oder am übergebenen Datum) fälligen, offenen, noch nicht
// zugewiesenen Tasks über die Fairness-Engine und schreibt die Zuweisung in die
// DB. Bereits zugewiesene Tasks bleiben unangetastet → gefahrlos wiederholbar
// (wird u.a. von scripts/tablet-start.sh bei jedem Serverstart aufgerufen).
//
// Aufruf: npm run plan:today            (heute)
//         npm run plan:today 2026-06-20 (bestimmter Tag, YYYY-MM-DD)
async function main() {
  const arg = process.argv[2];
  const day = arg ? new Date(arg) : new Date();
  day.setHours(0, 0, 0, 0);

  if (Number.isNaN(day.getTime())) {
    console.error(`Ungültiges Datum: ${arg} (erwartet YYYY-MM-DD).`);
    process.exitCode = 1;
    return;
  }

  try {
    const decisions = await planDueTasks(day);
    const count = (kind: string) => decisions.filter((d) => d.result.kind === kind).length;
    console.log(
      `Verteilung für ${day.toISOString().slice(0, 10)}: ${decisions.length} fällige Tasks → ` +
        `${count("assigned")} zugewiesen, ${count("deferred")} verschoben, ` +
        `${count("unassignable")} nicht zuweisbar.`,
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
