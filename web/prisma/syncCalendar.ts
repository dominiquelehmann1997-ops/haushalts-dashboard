import "dotenv/config";

import { prisma } from "../src/lib/db";
import { configuredCalendars, syncCalendar } from "../src/lib/services/calendarSync";

// Zieht die nächsten 14 Tage aus allen konfigurierten Google-Kalendern in die DB.
// Aufruf: npm run sync:calendar  (u.a. via scripts/tablet-start.sh + Termux-Cron).
async function main() {
  const calendars = configuredCalendars();
  if (calendars.length === 0) {
    console.error("Keine Kalender konfiguriert (GOOGLE_CALENDAR_* in .env).");
    process.exitCode = 1;
    return;
  }

  try {
    const { synced } = await syncCalendar(calendars);
    console.log(`Kalender-Sync: ${synced} Termine aktualisiert.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
