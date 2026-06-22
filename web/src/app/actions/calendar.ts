"use server";

import { revalidateDashboard } from "@/lib/revalidate";
import { configuredCalendars, syncCalendar } from "@/lib/services/calendarSync";
import { planDueTasks } from "@/lib/services/planning";
import { rollOverdueRoutines } from "@/lib/services/overdueCatchup";
import { getBusyWindows } from "@/lib/repositories/calendar";
import { getForecast } from "@/integrations/weather/openMeteo";
import { dayBounds } from "@/lib/dates";

/**
 * Synct die konfigurierten Google-Kalender, verteilt die heute fälligen,
 * offenen Aufgaben mit den frischen Terminen neu und revalidiert Tablet + Handy.
 * Fehler werden als Ergebnis zurückgegeben (kein Throw über die UI-Grenze).
 */
export async function syncCalendarAction(): Promise<
  { ok: true; synced: number } | { ok: false; error: string }
> {
  const calendars = configuredCalendars();
  if (calendars.length === 0) {
    return { ok: false, error: "Keine Kalender konfiguriert." };
  }

  try {
    const { synced } = await syncCalendar(calendars);

    const day = new Date();
    day.setHours(0, 0, 0, 0);
    const { start, end } = dayBounds(day);
    const busy = await getBusyWindows(start, end);
    let forecast: Awaited<ReturnType<typeof getForecast>> = [];
    try {
      forecast = await getForecast();
    } catch {
      forecast = [];
    }
    await rollOverdueRoutines(day);
    await planDueTasks(day, { busy, forecast });

    revalidateDashboard();
    return { ok: true, synced };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Sync fehlgeschlagen" };
  }
}
