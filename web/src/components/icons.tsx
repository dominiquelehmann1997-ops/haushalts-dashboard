import type { WeatherCondition } from "@/integrations/weather/openMeteo";

export function CheckIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" fill="none">
      <path
        d="M2.5 6.2 4.8 8.5 9.5 3.5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CloudRainGlyph() {
  return (
    <svg
      width="46"
      height="46"
      viewBox="0 0 46 46"
      fill="none"
      className="mb-1 text-ink-faint dark:text-cream/40"
    >
      <path
        d="M14 24a7 7 0 0 1 1.2-13.9 9 9 0 0 1 17.2 2.2A6.5 6.5 0 0 1 33 24H14Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M14 24a7 7 0 0 1 1.2-13.9 9 9 0 0 1 17.2 2.2A6.5 6.5 0 0 1 33 24H14Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path d="M17 29l-2 5M24 29l-2 5M31 29l-2 5" stroke="#5BA4D6" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

/**
 * Weather tile glyph, picked by condition. Previously the tile hard-rendered
 * `CloudRainGlyph` regardless of the actual weather, so a clear day still showed
 * a rain cloud. This couples the icon to `CurrentWeather.condition`.
 */
export function WeatherGlyph({ condition }: { condition: WeatherCondition }) {
  const wrap = "mb-1 text-ink-faint dark:text-cream/40";
  // Shared cloud body path (matches the old CloudRainGlyph cloud).
  const cloud = "M14 24a7 7 0 0 1 1.2-13.9 9 9 0 0 1 17.2 2.2A6.5 6.5 0 0 1 33 24H14Z";

  if (condition === "clear") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <circle cx="23" cy="22" r="8" fill="#F2B705" opacity="0.9" />
        <path
          d="M23 6v4M23 34v4M7 22h4M35 22h4M11.6 10.6l2.8 2.8M31.6 31.6l2.8 2.8M11.6 33.4l2.8-2.8M31.6 12.4l2.8-2.8"
          stroke="#F2B705"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
      </svg>
    );
  }

  if (condition === "partly") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <circle cx="17" cy="16" r="6.5" fill="#F2B705" opacity="0.9" />
        <path
          d="M17 4v3M5 16h3M8.6 7.6l2.1 2.1M25.4 7.6l-2.1 2.1"
          stroke="#F2B705"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path d={cloud} fill="currentColor" opacity="0.18" />
        <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
    );
  }

  if (condition === "fog") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <path d={cloud} fill="currentColor" opacity="0.18" />
        <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path
          d="M12 30h22M14 35h18"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          opacity="0.55"
        />
      </svg>
    );
  }

  if (condition === "snow") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <path d={cloud} fill="currentColor" opacity="0.18" />
        <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <g fill="#7FB3D5">
          <circle cx="16" cy="31" r="1.6" />
          <circle cx="23" cy="34" r="1.6" />
          <circle cx="30" cy="31" r="1.6" />
        </g>
      </svg>
    );
  }

  if (condition === "thunder") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <path d={cloud} fill="currentColor" opacity="0.18" />
        <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M24 27l-5 7h4l-2 6 7-9h-4l3-4z" fill="#F2B705" />
      </svg>
    );
  }

  if (condition === "rain") {
    return (
      <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
        <path d={cloud} fill="currentColor" opacity="0.18" />
        <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
        <path d="M17 29l-2 5M24 29l-2 5M31 29l-2 5" stroke="#5BA4D6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }

  // cloudy (and unknown fallback)
  return (
    <svg width="46" height="46" viewBox="0 0 46 46" fill="none" className={wrap}>
      <path d={cloud} fill="currentColor" opacity="0.18" />
      <path d={cloud} stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  );
}

export function CalendarGlyph() {
  return (
    <svg
      width="26"
      height="26"
      viewBox="0 0 26 26"
      fill="none"
      className="text-ink-faint dark:text-cream/40"
    >
      <rect x="3" y="5" width="20" height="18" rx="4" stroke="currentColor" strokeWidth="1.6" />
      <path d="M3 10h20M8 3v4M18 3v4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="9" cy="15" r="1.4" fill="#DD7A66" />
      <circle cx="13" cy="15" r="1.4" fill="#2E8B86" />
    </svg>
  );
}

export function SunIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="5" fill="currentColor" />
      <path
        d="M12 2v2M12 20v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M2 12h2M20 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function MoonIcon() {
  return (
    <svg width="19" height="19" viewBox="0 0 24 24" fill="none">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z" fill="currentColor" />
    </svg>
  );
}

export function RefreshIcon({ className = "w-5 h-5" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-2.64-6.36" />
      <path d="M21 3v6h-6" />
    </svg>
  );
}
