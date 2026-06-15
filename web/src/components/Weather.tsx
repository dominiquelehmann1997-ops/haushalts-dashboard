import { Card, CardHead } from "@/components/ui";
import { CloudRainGlyph } from "@/components/icons";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";

export function Weather({ weather }: { weather: CurrentWeather }) {
  return (
    <Card className="relative overflow-hidden h-full">
      <CardHead eyebrow="Wetter · Heute" title={weather.label} />
      <div className="flex items-end gap-3">
        <span className="text-[44px] leading-none font-display font-semibold text-ink dark:text-cream tracking-tight">
          {weather.temp}°
        </span>
        <CloudRainGlyph />
        <span className="ml-auto text-[13px] text-ink-soft dark:text-cream/55 tabular-nums">
          {weather.hi}° / {weather.lo}°
        </span>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 text-[12.5px] font-medium">
        {weather.rainFrom && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            ☔ {weather.detail}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-cream text-ink-soft dark:bg-white/5 dark:text-cream/60">
          💨 {weather.wind} km/h
        </span>
        {weather.uvIndex >= 3 && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            ☀️ UV {weather.uvIndex}
          </span>
        )}
      </div>
    </Card>
  );
}
