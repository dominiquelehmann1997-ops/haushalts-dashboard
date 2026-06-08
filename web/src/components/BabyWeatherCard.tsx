"use client";

import { useState } from "react";
import { Card, CardHead } from "@/components/ui";
import { recommendClothing } from "@/lib/baby/clothing";
import { uvAdvice } from "@/lib/baby/uv";
import { BABY } from "@/lib/baby/profile";
import type { AgeBand, Situation, Warmth, UvLevel } from "@/lib/baby/types";

const SITUATIONS: { key: Situation; label: string }[] = [
  { key: "allgemein", label: "Allgemein" },
  { key: "kinderwagen", label: "Kinderwagen" },
  { key: "babytrage", label: "Babytrage" },
  { key: "auto", label: "Auto" },
  { key: "schlafen", label: "Schlafen" },
  { key: "zuhause", label: "Zuhause" },
];

const WARMTH_TINT: Record<Warmth, string> = {
  heiß: "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  warm: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  mild: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  kühl: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  kalt: "bg-sky-50 text-sky-700 dark:bg-sky-500/15 dark:text-sky-300",
  frost: "bg-indigo-50 text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300",
};

const UV_TINT: Record<UvLevel, string> = {
  niedrig: "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300",
  mäßig: "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300",
  hoch: "bg-orange-50 text-orange-700 dark:bg-orange-500/15 dark:text-orange-300",
  "sehr hoch": "bg-rose-50 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300",
  extrem: "bg-rose-100 text-rose-800 dark:bg-rose-500/20 dark:text-rose-200",
};

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-[12px] font-medium px-2.5 py-1 rounded-full transition-colors ${
        active
          ? "bg-ink text-cream dark:bg-cream dark:text-ink"
          : "bg-cream text-ink-soft dark:bg-white/5 dark:text-cream/55 hover:bg-cream/70 dark:hover:bg-white/10"
      }`}
    >
      {children}
    </button>
  );
}

export function BabyWeatherCard({
  temp,
  uvIndex,
  ageBand,
  ageLabel,
}: {
  temp: number;
  uvIndex: number;
  ageBand: AgeBand;
  ageLabel: string;
}) {
  const [situation, setSituation] = useState<Situation>("allgemein");

  const clothing = recommendClothing({ tempC: temp, situation, ageBand });
  const uv = uvAdvice(uvIndex, ageBand);
  const showUv = uvIndex >= 3;

  return (
    <Card>
      <CardHead
        eyebrow="Baby-Wetter · Heute"
        title={`Für ${BABY.name}`}
        sub={`${ageLabel} alt`}
        right={
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-[12px] font-semibold px-2.5 py-1 rounded-full ${WARMTH_TINT[clothing.warmth]}`}
          >
            {temp}° · {clothing.warmth}
          </span>
        }
      />

      {/* Auswahl: Situation (Alter wird automatisch aus dem Geburtsdatum berechnet) */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {SITUATIONS.map((s) => (
          <Chip key={s.key} active={situation === s.key} onClick={() => setSituation(s.key)}>
            {s.label}
          </Chip>
        ))}
      </div>

      {/* Kleidungsempfehlung */}
      <div className="text-[11px] font-semibold tracking-[0.12em] uppercase text-ink-faint mb-2">
        Anziehen · {clothing.tempBand}
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {clothing.layers.map((layer, i) => (
          <li
            key={`${layer}-${i}`}
            className="text-[13px] text-ink dark:text-cream/85 bg-cream/70 dark:bg-white/[0.04] px-2.5 py-1 rounded-lg"
          >
            {layer}
          </li>
        ))}
      </ul>

      {clothing.hint && (
        <p className="text-[12.5px] text-ink-soft dark:text-cream/55 leading-snug mt-3">
          {clothing.hint}
        </p>
      )}

      {/* UV */}
      {showUv && (
        <div className="mt-4 flex items-start gap-2.5">
          <span
            className={`shrink-0 inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full ${UV_TINT[uv.level]}`}
          >
            ☀️ UV {uv.index} · {uv.level}
          </span>
          <p className="text-[12.5px] text-ink-soft dark:text-cream/55 leading-snug">{uv.advice}</p>
        </div>
      )}

      {/* Hinweis */}
      <p className="text-[11.5px] text-ink-faint mt-4 leading-snug">
        Orientierung nach dem Zwiebelprinzip — im Zweifel den <strong>Nackentest</strong> machen
        (Nacken warm &amp; trocken = wohl). Jedes Baby empfindet Wärme anders.
      </p>
    </Card>
  );
}
