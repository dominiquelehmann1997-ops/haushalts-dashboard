"use client";

// Mobile-Ansicht des aktiven Wochen-Essensplans. Jedes Gericht lässt sich
// aufklappen: Zutaten ansehen, das Gericht bei Bedarf noch tauschen (falls
// sich während der Woche etwas ändert) und die Zutaten gezielt auf Bring
// pushen — der bewusste Zwischenschritt statt eines automatischen Pushs
// beim Abnicken (siehe MealDraftPanel).

import { useState, useTransition } from "react";

import type { Meal, RecipeOption } from "@/lib/data";
import { Card } from "@/components/ui";
import { MealReasonBadge } from "@/components/widgets";
import {
  setActiveDayRecipeAction,
  pushMealIngredientsAction,
} from "@/app/actions/meals";
import type { BringPushResult } from "@/integrations/bring/client";

const PILL = "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

/** Formats an ingredient line: "Nudeln — 500 g" / "Olivenöl" (ohne Menge). */
function ingredientLabel(i: { name: string; amount: string | null; unit: string | null }): string {
  const amount = [i.amount, i.unit].filter(Boolean).join(" ");
  return amount ? `${i.name} — ${amount}` : i.name;
}

export function MealWeekList({ meals, recipes }: { meals: Meal[]; recipes: RecipeOption[] }) {
  const [openDay, setOpenDay] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [pushResult, setPushResult] = useState<{ entryId: string; bring: BringPushResult; items: string[] } | null>(
    null,
  );
  const [copied, setCopied] = useState(false);

  const toggle = (day: string) => {
    setOpenDay((cur) => (cur === day ? null : day));
    setPushResult(null);
    setCopied(false);
  };

  const handleSwap = (m: Meal, recipeId: string) => {
    if (!m.dateISO) return;
    setPushResult(null);
    startTransition(() => setActiveDayRecipeAction(m.dateISO!, recipeId));
  };

  const handlePush = (m: Meal) => {
    if (!m.id) return;
    setCopied(false);
    startTransition(async () => {
      const result = await pushMealIngredientsAction(m.id!);
      setPushResult({ entryId: m.id!, ...result });
    });
  };

  const handleCopy = (m: Meal) => {
    const text = (m.ingredients ?? []).map((i) => `• ${ingredientLabel(i)}`).join("\n");
    navigator.clipboard.writeText(text).then(() => setCopied(true));
  };

  return (
    <Card>
      <ul className="space-y-1.5">
        {meals.map((m) => {
          const open = openDay === m.day;
          const result = m.id && pushResult?.entryId === m.id ? pushResult : null;
          const alreadyPushed = result ? result.bring.ok : m.pushed;
          const bringFailed = result != null && !result.bring.ok;

          return (
            <li
              key={m.day}
              className={`rounded-2xl transition-colors ${
                m.today ? "bg-emely-tint dark:bg-emely/12 ring-1 ring-emely/25" : "bg-cream/60 dark:bg-white/[0.03]"
              }`}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => toggle(m.day)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(m.day);
                  }
                }}
                className="w-full flex items-center gap-3 px-3 py-2.5 text-left cursor-pointer"
                aria-expanded={open}
              >
                <span
                  className={`shrink-0 w-9 h-9 rounded-full grid place-items-center font-display font-semibold text-[13px] ${
                    m.today ? "bg-emely text-white" : "bg-white dark:bg-white/10 text-ink-soft dark:text-cream/60"
                  }`}
                >
                  {m.day}
                </span>
                {m.obsidianUrl ? (
                  <a
                    href={m.obsidianUrl}
                    onClick={(e) => e.stopPropagation()}
                    className={`flex-1 min-w-0 text-[14.5px] underline decoration-dotted underline-offset-2 ${
                      m.today ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/70"
                    } ${m.light ? "italic" : ""}`}
                    title="Rezept in Obsidian öffnen"
                  >
                    {m.dish}
                  </a>
                ) : (
                  <span
                    className={`flex-1 min-w-0 text-[14.5px] ${
                      m.today ? "font-semibold text-ink dark:text-cream" : "text-ink-soft dark:text-cream/70"
                    } ${m.light ? "italic" : ""}`}
                  >
                    {m.dish}
                  </span>
                )}
                <MealReasonBadge reason={m.reason} extraPortion={m.extraPortion} />
                {m.today && !open && (
                  <span className="text-[10.5px] font-bold tracking-wide uppercase text-emely-deep dark:text-emely">
                    Heute
                  </span>
                )}
                <span className="shrink-0 text-ink-faint text-[12px]">{open ? "▲" : "▼"}</span>
              </div>

              {open && (
                <div className="px-3 pb-3 space-y-3">
                  {m.ingredients && m.ingredients.length > 0 ? (
                    <ul className="text-[13px] text-ink-soft dark:text-cream/70 space-y-0.5">
                      {m.ingredients.map((i, idx) => (
                        <li key={idx}>{ingredientLabel(i)}</li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[13px] text-ink-faint">Keine Zutaten (Tag frei/Reste).</p>
                  )}

                  <div className="flex items-center gap-2 flex-wrap">
                    <select
                      key={m.recipeId ?? "skip"}
                      defaultValue={m.recipeId ?? ""}
                      disabled={pending}
                      onChange={(e) => handleSwap(m, e.target.value)}
                      className="text-[12px] rounded-lg bg-white dark:bg-white/10 px-1.5 py-1 max-w-[140px]"
                      aria-label={`${m.day} Gericht tauschen`}
                    >
                      <option value="">— überspringen</option>
                      {recipes.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name}
                        </option>
                      ))}
                    </select>

                    {m.id && (m.ingredients?.length ?? 0) > 0 && (
                      <button
                        type="button"
                        onClick={() => handlePush(m)}
                        disabled={pending}
                        className={`${PILL} disabled:cursor-wait ${
                          alreadyPushed
                            ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                            : "text-sky-700 bg-sky-50 dark:bg-sky-500/15 dark:text-sky-300 hover:bg-sky-100"
                        }`}
                      >
                        {pending
                          ? "…"
                          : alreadyPushed
                            ? "✓ Bereits gepusht"
                            : "Zutaten auf Bring pushen"}
                      </button>
                    )}
                  </div>

                  {bringFailed && (
                    <button
                      type="button"
                      onClick={() => handleCopy(m)}
                      className="text-[11px] font-semibold text-ink-faint hover:text-ink-soft underline decoration-dotted underline-offset-2"
                    >
                      {copied ? "Zutaten kopiert ✓" : "Bring fehlte — Zutaten zum Einfügen kopieren"}
                    </button>
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
