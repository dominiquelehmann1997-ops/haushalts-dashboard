// Realistic captured-shape Open-Meteo `/v1/forecast` JSON response, used as a
// fixture for the pure mapper tests (`mapForecast`/`mapCurrent`). No network.
//
// Covers:
// - Day 1 (2026-06-07, "today"): two separate rain periods (08:00–09:00 and
//   16:00–18:00) — exercises contiguous-run grouping into two `rainWindows`.
// - Day 2 (2026-06-08): fully dry (`rainWindows: []`).
// - `current`: matches the rainy "today" so `mapCurrent` can derive
//   `rainFrom`/`detail` from it.
//
// Shape mirrors the real API: `hourly.time` are local ISO-ish "YYYY-MM-DDTHH:MM"
// strings (because `timezone=auto`/explicit timezone is requested), `daily.time`
// are "YYYY-MM-DD" date strings.
export const openMeteoFixture = {
  latitude: 52.52,
  longitude: 13.41,
  generationtime_ms: 0.21,
  utc_offset_seconds: 7200,
  timezone: "Europe/Berlin",
  timezone_abbreviation: "CEST",
  elevation: 38,
  current: {
    time: "2026-06-07T14:00",
    temperature_2m: 18.4,
    weather_code: 61,
    uv_index: 4.2,
  },
  current_units: {
    temperature_2m: "°C",
    weather_code: "wmo code",
    uv_index: "",
  },
  hourly_units: {
    time: "iso8601",
    temperature_2m: "°C",
    precipitation: "mm",
  },
  hourly: {
    time: [
      "2026-06-07T00:00",
      "2026-06-07T01:00",
      "2026-06-07T02:00",
      "2026-06-07T03:00",
      "2026-06-07T04:00",
      "2026-06-07T05:00",
      "2026-06-07T06:00",
      "2026-06-07T07:00",
      "2026-06-07T08:00",
      "2026-06-07T09:00",
      "2026-06-07T10:00",
      "2026-06-07T11:00",
      "2026-06-07T12:00",
      "2026-06-07T13:00",
      "2026-06-07T14:00",
      "2026-06-07T15:00",
      "2026-06-07T16:00",
      "2026-06-07T17:00",
      "2026-06-07T18:00",
      "2026-06-07T19:00",
      "2026-06-07T20:00",
      "2026-06-07T21:00",
      "2026-06-07T22:00",
      "2026-06-07T23:00",
      "2026-06-08T00:00",
      "2026-06-08T01:00",
      "2026-06-08T02:00",
      "2026-06-08T03:00",
      "2026-06-08T04:00",
      "2026-06-08T05:00",
      "2026-06-08T06:00",
      "2026-06-08T07:00",
      "2026-06-08T08:00",
      "2026-06-08T09:00",
      "2026-06-08T10:00",
      "2026-06-08T11:00",
      "2026-06-08T12:00",
      "2026-06-08T13:00",
      "2026-06-08T14:00",
      "2026-06-08T15:00",
      "2026-06-08T16:00",
      "2026-06-08T17:00",
      "2026-06-08T18:00",
      "2026-06-08T19:00",
      "2026-06-08T20:00",
      "2026-06-08T21:00",
      "2026-06-08T22:00",
      "2026-06-08T23:00",
    ],
    temperature_2m: [
      11.2, 10.8, 10.5, 10.2, 10.1, 10.4, 11.0, 12.3, 13.8, 15.2, 16.5, 17.4, 18.1, 18.6, 18.4, 18.0, 17.5,
      16.9, 16.2, 15.4, 14.6, 13.8, 13.0, 12.2, 11.6, 11.1, 10.7, 10.4, 10.2, 10.5, 11.2, 12.6, 14.1, 15.6,
      16.9, 17.8, 18.4, 18.9, 19.1, 18.7, 18.2, 17.5, 16.7, 15.9, 15.0, 14.2, 13.4, 12.7,
    ],
    precipitation: [
      0, 0, 0, 0, 0, 0, 0, 0, 0.4, 0.6, 0, 0, 0, 0, 0, 0, 0.8, 1.2, 0.3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
      0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
    ],
  },
  daily_units: {
    time: "iso8601",
    temperature_2m_max: "°C",
    temperature_2m_min: "°C",
    weather_code: "wmo code",
  },
  daily: {
    time: ["2026-06-07", "2026-06-08"],
    temperature_2m_max: [18.6, 19.1],
    temperature_2m_min: [10.1, 10.2],
    weather_code: [61, 2],
    uv_index_max: [5.4, 6.8],
  },
};

export type OpenMeteoFixture = typeof openMeteoFixture;
