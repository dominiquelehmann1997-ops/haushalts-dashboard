import { Card } from "@/components/ui";
import { CloudRainGlyph } from "@/components/icons";
import type { CurrentWeather } from "@/integrations/weather/openMeteo";

export function Weather({ weather }: { weather: CurrentWeather }) {
  return (
    <Card className="relative overflow-hidden h-full flex flex-col justify-center !p-3 sm:!p-4">
      <div className="flex items-center gap-3">
        <span className="text-[40px] leading-none font-display font-semibold text-ink dark:text-cream tracking-tight">
          {weather.temp}°
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-semibold tracking-[0.18em] uppercase text-ink-faint leading-none">
            Wetter · Heute
          </div>
          <div className="text-[15px] font-semibold text-ink dark:text-cream leading-tight truncate mt-0.5">
            {weather.label}
          </div>
          <div className="text-[12px] text-ink-soft dark:text-cream/55 tabular-nums leading-tight">
            {weather.hi}° / {weather.lo}°
          </div>
        </div>
        <CloudRainGlyph />
      </div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[12px] font-medium">
        {weather.rainFrom && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300">
            ☔ {weather.detail}
          </span>
        )}
        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-cream text-ink-soft dark:bg-white/5 dark:text-cream/60">
          💨 {weather.wind} km/h
        </span>
        {weather.uvIndex >= 3 && (
          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
            ☀️ UV {weather.uvIndex}
          </span>
        )}
      </div>
    </Card>
  );
}
