// Open-Meteo integration (Phase 5) — free weather forecast API, no API key
// required. See https://open-meteo.com/en/docs.
//
// Split into pure mappers (network/env-free, unit-tested with a fixture) and a
// thin network wrapper (not unit-tested — would hit the network).
//
// `mapForecast` produces the engine's `DayForecast[]` input
// (`@/lib/engine/types`), `mapCurrent` reproduces the `weather` tile shape from
// `@/lib/data` so Phase 8 can render it unchanged.

import type { DayForecast } from "@/lib/engine/types";

/** Berlin coordinates — used as a fallback when `WEATHER_LAT`/`WEATHER_LON` are unset. */
const DEFAULT_LAT = 52.52;
const DEFAULT_LON = 13.41;

const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";

/** Shape of the raw Open-Meteo `/v1/forecast` JSON response (the fields we use). */
export interface OpenMeteoResponse {
  current?: {
    time: string;
    temperature_2m: number;
    weather_code: number;
    uv_index?: number;
    wind_speed_10m?: number;
  };
  hourly: {
    time: string[]; // local "YYYY-MM-DDTHH:MM" (timezone applied)
    temperature_2m: number[];
    precipitation: number[];
  };
  daily: {
    time: string[]; // "YYYY-MM-DD"
    temperature_2m_max: number[];
    temperature_2m_min: number[];
    weather_code: number[];
    uv_index_max: number[];
  };
}

export interface CurrentWeather {
  temp: number;
  label: string;
  detail: string;
  hi: number;
  lo: number;
  rainFrom: string;
  uvIndex: number;
  wind: number;
}

/** Splits a local "YYYY-MM-DDTHH:MM" hourly timestamp into its date key and "HH:MM" time. */
function splitHourlyTimestamp(timestamp: string): { date: string; time: string } {
  const [date, time] = timestamp.split("T");
  return { date, time };
}

/**
 * Derives `rainWindows` for a single day from the hourly `precipitation`
 * array: contiguous runs of hours with `precipitation > 0` become one
 * `{from, to}` interval each — `from` is the first wet hour's "HH:MM",
 * `to` is the *end* of the last contiguous wet hour (i.e. the next hour's
 * "HH:MM", one hour after `from` of that run's last entry).
 */
function deriveRainWindows(
  hours: { time: string; precipitation: number }[],
): { from: string; to: string }[] {
  const windows: { from: string; to: string }[] = [];
  let runStart: string | null = null;
  let runLastIndex = -1;

  const closeRun = () => {
    if (runStart === null) return;
    const lastHour = hours[runLastIndex];
    const [hh, mm] = lastHour.time.split(":").map(Number);
    const endDate = new Date(2000, 0, 1, hh, mm);
    endDate.setHours(endDate.getHours() + 1);
    const to = `${endDate.getHours().toString().padStart(2, "0")}:${endDate
      .getMinutes()
      .toString()
      .padStart(2, "0")}`;
    windows.push({ from: runStart, to });
    runStart = null;
    runLastIndex = -1;
  };

  hours.forEach((hour, index) => {
    if (hour.precipitation > 0) {
      if (runStart === null) {
        runStart = hour.time;
      }
      runLastIndex = index;
    } else {
      closeRun();
    }
    void index;
  });
  closeRun();

  return windows;
}

/**
 * Maps a raw Open-Meteo response into the engine's `DayForecast[]` — pure,
 * no network/env access. For each daily entry, groups that day's hourly
 * `precipitation` into contiguous rain windows and reads `minTemp`/`maxTemp`
 * from the daily min/max arrays.
 */
export function mapForecast(raw: OpenMeteoResponse): DayForecast[] {
  const hourly = raw.hourly.time.map((time, index) => {
    const { date, time: hhmm } = splitHourlyTimestamp(time);
    return { date, time: hhmm, precipitation: raw.hourly.precipitation[index] };
  });

  return raw.daily.time.map((date, index) => {
    const dayHours = hourly.filter((h) => h.date === date);
    return {
      date,
      rainWindows: deriveRainWindows(dayHours),
      minTemp: Math.round(raw.daily.temperature_2m_min[index]),
      maxTemp: Math.round(raw.daily.temperature_2m_max[index]),
    };
  });
}

/** German label for the common WMO weather codes (https://open-meteo.com/en/docs — "WMO Weather interpretation codes"). */
function labelForCode(code: number): string {
  if (code === 0) return "Klar";
  if (code >= 1 && code <= 3) return code === 1 ? "Heiter" : "Bewölkt";
  if (code === 45 || code === 48) return "Nebel";
  if (code >= 51 && code <= 67) return "Regen";
  if (code >= 71 && code <= 77) return "Schnee";
  if (code >= 80 && code <= 82) return "Regenschauer";
  if (code >= 95 && code <= 99) return "Gewitter";
  return "Unbekannt";
}

/**
 * Maps a raw Open-Meteo response into the `weather` tile shape (see
 * `@/lib/data`'s `weather` export) — pure, no network/env access.
 *
 * `rainFrom` is the first hour of *today* (the date of `current.time`) with
 * `precipitation > 0`, formatted "HH:MM" (or `""` if no rain is forecast
 * today). `detail` reads `"Regen ab ${rainFrom} Uhr"` when there is rain
 * today, otherwise falls back to the day's label.
 */
export function mapCurrent(raw: OpenMeteoResponse): CurrentWeather {
  const current = raw.current;
  const todayKey = current ? splitHourlyTimestamp(current.time).date : raw.daily.time[0];
  const dailyIndex = raw.daily.time.indexOf(todayKey);

  const todayHours = raw.hourly.time
    .map((time, index) => ({ ...splitHourlyTimestamp(time), precipitation: raw.hourly.precipitation[index] }))
    .filter((h) => h.date === todayKey);

  const firstRain = todayHours.find((h) => h.precipitation > 0);
  const rainFrom = firstRain?.time ?? "";

  const label = current ? labelForCode(current.weather_code) : labelForCode(raw.daily.weather_code[dailyIndex]);
  const detail = rainFrom ? `Regen ab ${rainFrom} Uhr` : label;

  const uvIndex = Math.round(
    current?.uv_index ?? raw.daily.uv_index_max[dailyIndex] ?? 0,
  );

  const wind = Math.round(current?.wind_speed_10m ?? 0);

  return {
    temp: current ? Math.round(current.temperature_2m) : Math.round(raw.daily.temperature_2m_max[dailyIndex]),
    label,
    detail,
    hi: Math.round(raw.daily.temperature_2m_max[dailyIndex]),
    lo: Math.round(raw.daily.temperature_2m_min[dailyIndex]),
    rainFrom,
    uvIndex,
    wind,
  };
}

/** Reads the household's coordinates from env, falling back to Berlin defaults. */
function coordinates(): { lat: number; lon: number } {
  const lat = Number(process.env.WEATHER_LAT);
  const lon = Number(process.env.WEATHER_LON);
  return {
    lat: Number.isFinite(lat) && process.env.WEATHER_LAT ? lat : DEFAULT_LAT,
    lon: Number.isFinite(lon) && process.env.WEATHER_LON ? lon : DEFAULT_LON,
  };
}

function buildUrl(days: number): string {
  const { lat, lon } = coordinates();
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    hourly: "precipitation,temperature_2m",
    daily: "temperature_2m_max,temperature_2m_min,weather_code,uv_index_max",
    current: "temperature_2m,weather_code,uv_index,wind_speed_10m",
    timezone: "auto",
    forecast_days: String(days),
  });
  return `${FORECAST_URL}?${params.toString()}`;
}

/**
 * Fetches the forecast for the next `days` days and maps it to the engine's
 * `DayForecast[]`. NOT unit-tested (network I/O) — `mapForecast` carries the
 * tested logic.
 *
 * On fetch/parse failure this throws (the caller — Phase 8's data loading —
 * decides how to degrade, e.g. by catching and falling back to `forecast: []`,
 * which keeps `planDueTasks`/the engine working with "no data" semantics).
 * Uses Next's fetch cache with a 30-minute revalidation window since Open-Meteo
 * forecasts don't change more often than that in practice.
 */
export async function getForecast(days = 5): Promise<DayForecast[]> {
  const response = await fetch(buildUrl(days), { next: { revalidate: 1800 } });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status} ${response.statusText}`);
  }
  const raw = (await response.json()) as OpenMeteoResponse;
  return mapForecast(raw);
}

/**
 * Fetches current conditions + today's min/max and maps them to the `weather`
 * tile shape. NOT unit-tested (network I/O) — `mapCurrent` carries the tested
 * logic. Same fetch-failure behavior as `getForecast` (throws; caller decides
 * fallback).
 */
export async function getCurrent(): Promise<CurrentWeather> {
  const response = await fetch(buildUrl(1), { next: { revalidate: 1800 } });
  if (!response.ok) {
    throw new Error(`Open-Meteo request failed: ${response.status} ${response.statusText}`);
  }
  const raw = (await response.json()) as OpenMeteoResponse;
  return mapCurrent(raw);
}
