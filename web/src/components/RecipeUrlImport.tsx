"use client";

// Rezept per Link übernehmen: URL einfügen → das Rezept landet als Notiz im
// Obsidian-Vault und ist sofort im Essensplan wählbar. Liest die schema.org-
// Daten der Rezeptseite (kein LLM, keine Kosten) — siehe recipeImport.ts.

import { useState, useTransition } from "react";

import { importRecipeUrlAction, type RecipeUrlImportResult } from "@/app/actions/recipes";

const PILL =
  "inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full transition-colors";

export function RecipeUrlImport() {
  const [url, setUrl] = useState("");
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<RecipeUrlImportResult | null>(null);

  const submit = () => {
    if (!url.trim() || pending) return;
    setResult(null);
    startTransition(async () => {
      const res = await importRecipeUrlAction(url);
      setResult(res);
      if (res.ok) setUrl("");
    });
  };

  // Auf dem Handy der bequemste Weg: Link in der Rezept-App/Browser kopieren,
  // hier einmal auf "Einfügen" tippen. Schlägt fehl, wenn der Browser den
  // Clipboard-Zugriff verweigert — dann bleibt das normale Einfügen ins Feld.
  const pasteFromClipboard = () => {
    navigator.clipboard
      ?.readText()
      .then((text) => text && setUrl(text.trim()))
      .catch(() => {});
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-ink dark:text-cream/90">Rezept per Link</h3>
        <button
          type="button"
          onClick={pasteFromClipboard}
          className={`${PILL} text-ink-soft bg-cream/70 dark:bg-white/[0.04] hover:bg-cream dark:hover:bg-white/[0.07]`}
        >
          Einfügen
        </button>
      </div>

      <div className="flex gap-2">
        <input
          type="url"
          inputMode="url"
          autoComplete="off"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="https://www.chefkoch.de/rezepte/…"
          className="flex-1 min-w-0 rounded-xl border border-ink/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] px-3 py-2 text-[13px] text-ink dark:text-cream/90 placeholder:text-ink-faint dark:placeholder:text-cream/40 outline-none focus:border-ink/25 dark:focus:border-white/25"
        />
        <button
          type="button"
          onClick={submit}
          disabled={pending || url.trim() === ""}
          className={`${PILL} shrink-0 text-ink-soft bg-white/60 dark:bg-white/[0.06] hover:bg-white dark:hover:bg-white/10 disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {pending ? "hole …" : "übernehmen"}
        </button>
      </div>

      {result?.ok && (
        <p className="text-[12px] text-emerald-700 dark:text-emerald-300">
          {result.updated ? "↻ aktualisiert" : "✓ übernommen"}: {result.name} —{" "}
          {result.ingredientCount} Zutaten
          {result.kcal !== null ? `, ${result.kcal} kcal/Portion` : ""}
          {result.error ? ` (Hinweis: ${result.error})` : ""}
        </p>
      )}
      {result && !result.ok && (
        <p className="text-[12px] text-amber-700 dark:text-amber-300">{result.error}</p>
      )}
    </div>
  );
}
