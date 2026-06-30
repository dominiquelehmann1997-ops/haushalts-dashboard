"use client";

// Phase 2: Claude schlägt neue Rezepte vor (OAuth-Abo via `claude` CLI).
// Generieren zeigt Vorschlagskarten; "übernehmen" schreibt das Rezept in den
// Vault + DB. Vorschläge sind flüchtig (nicht persistiert) bis übernommen.

import { useState, useTransition } from "react";

import { acceptRecipeIdeaAction, generateRecipeIdeasAction } from "@/app/actions/recipeIdeas";
import type { RecipeIdea } from "@/lib/services/recipeIdeas";

const PILL =
  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

type Status = "idle" | "accepted" | "failed";

export function RecipeIdeasControl() {
  const [pending, startTransition] = useTransition();
  const [ideas, setIdeas] = useState<RecipeIdea[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<Record<string, Status>>({});
  const [acceptingId, setAcceptingId] = useState<string | null>(null);

  const generate = () => {
    setError(null);
    setStatus({});
    startTransition(async () => {
      const res = await generateRecipeIdeasAction(3);
      setIdeas(res.ideas);
      setError(res.error);
    });
  };

  const accept = (idea: RecipeIdea) => {
    setAcceptingId(idea.name);
    startTransition(async () => {
      const res = await acceptRecipeIdeaAction(idea);
      setStatus((s) => ({ ...s, [idea.name]: res.ok ? "accepted" : "failed" }));
      if (!res.ok && res.error) setError(res.error);
      setAcceptingId(null);
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink dark:text-cream/90">Rezept-Ideen</h3>
        <button
          type="button"
          onClick={generate}
          disabled={pending}
          className={`${PILL} text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07] disabled:cursor-wait`}
        >
          {pending && ideas.length === 0 ? "Claude denkt …" : "✨ Neue Ideen"}
        </button>
      </div>

      {error && <p className="text-[12px] text-amber-700 dark:text-amber-300">{error}</p>}

      <ul className="space-y-2">
        {ideas.map((idea) => {
          const st = status[idea.name];
          return (
            <li
              key={idea.name}
              className="rounded-xl border border-ink/5 dark:border-white/10 bg-cream/40 dark:bg-white/[0.03] p-3 space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[14px] font-semibold text-ink dark:text-cream/90">{idea.name}</p>
                  {idea.tags.length > 0 && (
                    <p className="text-[11px] text-ink-faint dark:text-cream/50">{idea.tags.join(" · ")}</p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => accept(idea)}
                  disabled={pending || st === "accepted"}
                  className={`${PILL} shrink-0 ${
                    st === "accepted"
                      ? "text-emerald-700 bg-emerald-50 dark:bg-emerald-500/15 dark:text-emerald-300"
                      : "text-ink-soft bg-white/60 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/10"
                  } disabled:cursor-wait`}
                >
                  {st === "accepted"
                    ? "✓ übernommen"
                    : acceptingId === idea.name
                      ? "speichere …"
                      : "übernehmen"}
                </button>
              </div>
              <p className="text-[12px] text-ink-soft dark:text-cream/60">
                {idea.ingredients.map((i) => i.name).join(", ")}
              </p>
              {idea.steps && (
                <p className="text-[12px] text-ink-faint dark:text-cream/50 line-clamp-3">{idea.steps}</p>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
