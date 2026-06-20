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
