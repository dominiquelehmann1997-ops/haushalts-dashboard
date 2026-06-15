import type { Dispatch, SetStateAction } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";

export function Header({
  dark,
  setDark,
  todayLabel,
}: {
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
  todayLabel: { weekday: string; date: string };
}) {
  return (
    <header className="flex items-center justify-between gap-4">
      <div>
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-faint">
            Unser Zuhause
          </span>
        </div>
        <h1 className="font-display font-bold text-ink dark:text-cream tracking-tight leading-none text-[26px] sm:text-[32px] mt-0.5">
          Heute<span className="text-emely">.</span>
        </h1>
        <p className="text-[13px] text-ink-soft dark:text-cream/55 mt-1">
          {todayLabel.weekday}, {todayLabel.date} · Was ist dran — und wer macht was?
        </p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="hidden sm:flex items-center gap-2 mr-1">
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft dark:text-cream/60">
            <span className="w-2.5 h-2.5 rounded-full bg-dome"></span>Dome
          </span>
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-ink-soft dark:text-cream/60">
            <span className="w-2.5 h-2.5 rounded-full bg-emely"></span>Emely
          </span>
        </div>
        <button
          onClick={() => setDark((d) => !d)}
          aria-label="Dark Mode umschalten"
          className="w-11 h-11 grid place-items-center rounded-full bg-white dark:bg-[#26241F] shadow-card text-ink-soft dark:text-cream/70 hover:scale-105 active:scale-95 transition-transform"
        >
          {dark ? <SunIcon /> : <MoonIcon />}
        </button>
      </div>
    </header>
  );
}
