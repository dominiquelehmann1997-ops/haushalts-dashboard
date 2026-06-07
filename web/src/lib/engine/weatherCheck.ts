import type { DayForecast, EngineTask } from "./types";

type WeatherResult = { ok: true } | { ok: false; suggestedDay: Date; reason: string };

/** Formats a Date as a local "YYYY-MM-DD" string (matches `DayForecast.date`). */
function toLocalDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = (date.getMonth() + 1).toString().padStart(2, "0");
  const day = date.getDate().toString().padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/** Parses a "YYYY-MM-DD" date key into a local-midnight Date. */
function fromLocalDateKey(key: string): Date {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

/** Parses a local "HH:MM" time string into minutes-since-midnight. */
function toMinutes(hhmm: string): number {
  const [hours, minutes] = hhmm.split(":").map(Number);
  return hours * 60 + minutes;
}

/**
 * True when any of `forecast`'s rain windows on that day overlaps `window`
 * (compared as local HH:MM ranges). Without a `window`, any rain that day counts.
 */
function hasConflictingRain(
  forecast: DayForecast,
  window: { start: Date; end: Date } | undefined,
): boolean {
  if (!window) return forecast.rainWindows.length > 0;

  const windowStart = window.start.getHours() * 60 + window.start.getMinutes();
  const windowEnd = window.end.getHours() * 60 + window.end.getMinutes();

  return forecast.rainWindows.some((rw) => {
    const rainStart = toMinutes(rw.from);
    const rainEnd = toMinutes(rw.to);
    return rainStart < windowEnd && rainEnd > windowStart;
  });
}

/** Whether `forecast` satisfies the task's weather condition. */
function satisfies(
  condition: NonNullable<EngineTask["weatherCondition"]>,
  forecast: DayForecast,
  window: { start: Date; end: Date } | undefined,
): { ok: boolean; reason: string } {
  if (condition.noRain && hasConflictingRain(forecast, window)) {
    return { ok: false, reason: "Regen" };
  }

  if (condition.minTemp !== undefined && forecast.maxTemp < condition.minTemp) {
    return { ok: false, reason: "zu kalt" };
  }

  return { ok: true, reason: "" };
}

/**
 * Checks whether `task` can go ahead outdoors on `day` given the `forecast`.
 * Non-outdoor tasks are always ok. Outdoor tasks without weather data for `day`
 * are also treated as ok (no data must not block planning).
 */
export function checkWeather(
  task: EngineTask,
  day: Date,
  forecast: DayForecast[],
  window?: { start: Date; end: Date },
): WeatherResult {
  if (!task.outdoor || !task.weatherCondition) return { ok: true };

  const condition = task.weatherCondition;
  const dayKey = toLocalDateKey(day);
  const todayForecast = forecast.find((f) => f.date === dayKey);

  if (!todayForecast) return { ok: true };

  const today = satisfies(condition, todayForecast, window);
  if (today.ok) return { ok: true };

  const later = forecast
    .filter((f) => f.date > dayKey)
    .sort((a, b) => (a.date < b.date ? -1 : 1))
    .find((f) => satisfies(condition, f, window).ok);

  if (later) {
    return { ok: false, suggestedDay: fromLocalDateKey(later.date), reason: today.reason };
  }

  const fallback = new Date(day);
  fallback.setDate(fallback.getDate() + 1);
  return { ok: false, suggestedDay: fallback, reason: today.reason };
}
