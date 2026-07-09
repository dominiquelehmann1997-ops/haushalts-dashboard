"use client";

import { useEffect, useState } from "react";
import { Sun, Moon, SunMoon } from "lucide-react";
import { THEME_KEY, type ThemePref } from "@/lib/theme";

const OPTIONS: { value: ThemePref; label: string; Icon: typeof Sun }[] = [
  { value: "light", label: "Hell", Icon: Sun },
  { value: "dark", label: "Dunkel", Icon: Moon },
  { value: "auto", label: "Automatisch", Icon: SunMoon },
];

/** Wendet die Design-Wahl sofort aufs `<html>` an (dark-Klasse + color-scheme). */
function applyTheme(pref: ThemePref) {
  const dark =
    pref === "dark" ||
    (pref === "auto" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  const el = document.documentElement;
  el.classList.toggle("dark", dark);
  el.style.colorScheme = dark ? "dark" : "light";
}

/**
 * Manueller Hell/Dunkel/Automatisch-Schalter fürs Handy. Persistiert in
 * `localStorage` (Schlüssel `THEME_KEY`), damit das Inline-Skript in
 * `layout.tsx` beim nächsten Laden sofort das richtige Design malt.
 * Bei "Automatisch" folgt das Design live der OS-Einstellung.
 */
export function ThemeToggle() {
  const [pref, setPref] = useState<ThemePref>("auto");

  // Gespeicherte Wahl erst nach dem Mount einlesen: localStorage steht beim
  // SSR nicht zur Verfügung, und ein Lazy-Init würde Server (immer "auto") und
  // Client (evtl. "dark") auseinanderlaufen lassen → Hydration-Mismatch.
  useEffect(() => {
    try {
      const stored = localStorage.getItem(THEME_KEY);
      // eslint-disable-next-line react-hooks/set-state-in-effect -- externe Quelle (localStorage) nach Mount spiegeln
      if (stored === "light" || stored === "dark" || stored === "auto") setPref(stored);
    } catch {
      /* localStorage evtl. blockiert */
    }
  }, []);

  // Bei "Automatisch" auf OS-Wechsel reagieren, solange aktiv.
  useEffect(() => {
    if (pref !== "auto") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => applyTheme("auto");
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const choose = (next: ThemePref) => {
    setPref(next);
    try {
      localStorage.setItem(THEME_KEY, next);
    } catch {
      /* localStorage evtl. blockiert */
    }
    applyTheme(next);
  };

  return (
    <div className="grid grid-cols-3 gap-2">
      {OPTIONS.map(({ value, label, Icon }) => {
        const active = pref === value;
        return (
          <button
            key={value}
            type="button"
            onClick={() => choose(value)}
            aria-pressed={active}
            className={`flex flex-col items-center gap-1.5 rounded-2xl py-3 text-[12px] font-semibold transition-colors ${
              active
                ? "bg-ink text-cream dark:bg-cream dark:text-ink"
                : "bg-cream/60 text-ink-soft dark:bg-white/[0.05] dark:text-cream/60"
            }`}
          >
            <Icon size={20} strokeWidth={2} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
