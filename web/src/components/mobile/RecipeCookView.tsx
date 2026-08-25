"use client";

// Kochansicht: Zutaten und Zubereitung nebeneinander, jede Spalte für sich
// scrollbar. Beim Kochen will man beides gleichzeitig sehen — auf der
// Detailseite steht die Zubereitung unter den Zutaten, und bei Rezepten mit
// bis zu 32 Zutaten scrollt man die Anleitung dauernd aus dem Bild.
//
// Zwei Kleinigkeiten, die den Unterschied machen, wenn man klebrige Finger hat:
//   - Der Bildschirm bleibt an, solange die Ansicht offen ist.
//   - Angetippte Schritte werden abgehakt, damit man nach dem Rühren
//     wiederfindet, wo man war.

import { useEffect, useState } from "react";
import { Check } from "lucide-react";

import type { Recipe } from "@/lib/domain";

/**
 * Hält den Bildschirm an, solange die Ansicht offen ist.
 *
 * Der Lock geht verloren, sobald die Seite in den Hintergrund gerät (so ist die
 * API definiert) — deshalb wird er beim Zurückkommen neu angefordert. Kann der
 * Browser das nicht oder verweigert er, passiert schlicht nichts: ein
 * dunkler Bildschirm ist ärgerlich, aber kein Grund, die Seite zu stören.
 */
function useWakeLock(): void {
  useEffect(() => {
    if (!("wakeLock" in navigator)) return;

    let sentinel: WakeLockSentinel | null = null;
    let released = false;

    const acquire = async () => {
      try {
        const next = await navigator.wakeLock.request("screen");
        // Zwischenzeitlich verlassen? Dann sofort wieder freigeben.
        if (released) void next.release().catch(() => {});
        else sentinel = next;
      } catch {
        // nicht verfügbar, kein Nutzergesteneffekt, Akkusparmodus — egal.
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible" && !released) void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      released = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, []);
}

/** Eine Spalte mit eigener Scrollfläche. */
function Pane({
  title,
  count,
  children,
}: {
  title: string;
  count?: string;
  children: React.ReactNode;
}) {
  return (
    // min-h-0 ist hier nicht kosmetisch: ohne das wächst ein Flex-Kind auf
    // seine Inhaltshöhe und das innere overflow-y-auto greift nie.
    <section className="flex flex-col min-h-0 rounded-2xl bg-white/60 dark:bg-white/[0.04] p-3">
      <h2 className="shrink-0 flex items-baseline justify-between gap-2 mb-2 text-[11px] font-semibold tracking-[0.14em] uppercase text-ink-faint">
        {title}
        {count && <span className="text-[10.5px] tracking-normal normal-case">{count}</span>}
      </h2>
      <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain pr-1">{children}</div>
    </section>
  );
}

export function RecipeCookView({ recipe }: { recipe: Recipe }) {
  useWakeLock();

  const [done, setDone] = useState<ReadonlySet<number>>(() => new Set());

  const toggleStep = (index: number) =>
    setDone((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });

  const openSteps = recipe.steps.length - done.size;

  return (
    // Feste Höhe statt mitwachsend: nur so bekommen beide Spalten eine
    // begrenzte Fläche, in der sie unabhängig scrollen können. 100svh statt
    // 100vh, damit die Android-Systemleisten nicht die letzte Zeile abschneiden.
    <div className="grid gap-3 md:grid-cols-2 h-[calc(100svh-13rem)] min-h-[22rem]">
      <Pane
        title="Zutaten"
        count={
          recipe.servings !== null
            ? `für ${recipe.servings} ${recipe.servings === 1 ? "Portion" : "Portionen"}`
            : undefined
        }
      >
        {recipe.ingredients.length > 0 ? (
          <ul className="divide-y divide-ink/5 dark:divide-white/5">
            {recipe.ingredients.map((i) => (
              <li key={i.id} className="flex items-baseline gap-2.5 py-1.5">
                <span className="shrink-0 min-w-[3.5rem] text-[13px] text-ink-soft dark:text-cream/60 tabular-nums">
                  {[i.amount, i.unit].filter(Boolean).join(" ")}
                </span>
                <span className="text-[13.5px] text-ink dark:text-cream/85">{i.name}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-faint">Keine Zutaten hinterlegt.</p>
        )}
      </Pane>

      <Pane
        title="Zubereitung"
        count={
          recipe.steps.length > 0
            ? openSteps === 0
              ? "fertig"
              : `noch ${openSteps} von ${recipe.steps.length}`
            : undefined
        }
      >
        {recipe.steps.length > 0 ? (
          <ol className="space-y-1">
            {recipe.steps.map((step, index) => {
              const checked = done.has(index);
              return (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => toggleStep(index)}
                    aria-pressed={checked}
                    className="w-full flex gap-2.5 text-left rounded-xl px-1.5 py-2
                               hover:bg-cream/60 dark:hover:bg-white/[0.05] transition-colors"
                  >
                    <span
                      className={
                        "shrink-0 w-6 h-6 rounded-full grid place-items-center text-[11px] font-semibold transition-colors " +
                        (checked
                          ? "bg-dome-deep text-white"
                          : "bg-cream dark:bg-white/[0.08] text-ink-soft dark:text-cream/70")
                      }
                    >
                      {checked ? <Check size={13} strokeWidth={2.6} /> : index + 1}
                    </span>
                    <span
                      className={
                        "text-[13.5px] leading-relaxed transition-colors " +
                        (checked
                          ? "text-ink-faint line-through decoration-ink-faint/50"
                          : "text-ink dark:text-cream/85")
                      }
                    >
                      {step}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="text-[13px] text-ink-faint">
            Für dieses Rezept ist keine Zubereitung hinterlegt — in der Bearbeitung nachtragen.
          </p>
        )}
      </Pane>
    </div>
  );
}
