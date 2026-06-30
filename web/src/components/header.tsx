"use client";

import { useEffect, useState } from "react";
import type { Dispatch, SetStateAction } from "react";
import { SunIcon, MoonIcon } from "@/components/icons";
import { SyncButton } from "@/components/SyncButton";

function useClock() {
  const [time, setTime] = useState("");
  useEffect(() => {
    const tick = () =>
      setTime(
        new Date().toLocaleTimeString("de-DE", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: false,
        }),
      );
    tick();
    const id = setInterval(tick, 1000); // ponytail: 1s tick keeps minute flip prompt across sleep/wake
    return () => clearInterval(id);
  }, []);
  return time;
}

export function Header({
  dark,
  setDark,
  todayLabel,
}: {
  dark: boolean;
  setDark: Dispatch<SetStateAction<boolean>>;
  todayLabel: { weekday: string; date: string };
}) {
  const time = useClock();
  const [hh, mm] = (time || "00:00").split(":");
  return (
    <header className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className={`font-display font-bold text-ink dark:text-cream tracking-tight leading-none text-[44px] sm:text-[58px] tabular-nums transition-opacity ${
            time ? "opacity-100" : "opacity-0"
          }`}
        >
          {hh}
          <span className="text-emely animate-clock-blink">:</span>
          {mm}
        </div>
        <div className="h-10 sm:h-12 w-px bg-ink/10 dark:bg-cream/15" />
        <div className="leading-none">
          <div className="text-[11px] font-semibold tracking-[0.2em] uppercase text-ink-faint">
            {todayLabel.weekday}
          </div>
          <div className="text-[15px] sm:text-[17px] font-semibold text-ink dark:text-cream mt-1.5">
            {todayLabel.date}
          </div>
        </div>
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
        <SyncButton />
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
