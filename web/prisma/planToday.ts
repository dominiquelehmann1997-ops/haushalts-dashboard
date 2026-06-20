import "dotenv/config";

import { prisma } from "../src/lib/db";
import { planDueTasks } from "../src/lib/services/planning";
import { getBusyWindows } from "../src/lib/repositories/calendar";
import { getForecast } from "../src/integrations/weather/openMeteo";
import { dayBounds } from "../src/lib/dates";

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
    const { start, end } = dayBounds(day);
    let busy: Awaited<ReturnType<typeof getBusyWindows>> = [];
    let forecast: Awaited<ReturnType<typeof getForecast>> = [];
    try {
      busy = await getBusyWindows(start, end);
    } catch (e) {
      console.warn("Busy-Windows konnten nicht geladen werden:", e);
    }
    try {
      forecast = await getForecast();
    } catch (e) {
      console.warn("Forecast konnte nicht geladen werden:", e);
    }

    const decisions = await planDueTasks(day, { busy, forecast });
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
