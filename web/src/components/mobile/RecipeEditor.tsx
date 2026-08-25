"use client";

// Rezept anlegen und bearbeiten. Dasselbe Formular für beides: `recipe`
// gesetzt = bearbeiten, sonst neu.
//
// Der Zustand ist ein `RecipeDraft` aus lauter Strings; die ganze Umrechnerei
// nach `RecipeInput` steht rein und getestet in `recipeForm.ts`. Verdrahtet
// ist das per `startTransition` (Hausform, siehe NotesEditor), nicht per
// `useActionState` — das Formular trägt mehr Zustand, als ein FormData fasst.

import { useState, startTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, X } from "lucide-react";

import type { Recipe } from "@/lib/domain";
import { createRecipeAction, updateRecipeAction } from "@/app/actions/recipes";
import { RECIPES_PATH } from "@/lib/recipeFilterParams";
import {
  draftError,
  draftFromRecipe,
  draftToInput,
  emptyDraft,
  EMPTY_INGREDIENT,
  moveItem,
  RATINGS,
  type RecipeDraft,
  type RecipeDraftIngredient,
} from "@/lib/services/recipeForm";

const FIELD =
  "w-full rounded-xl border border-ink/10 dark:border-white/10 bg-white/70 dark:bg-white/[0.04] " +
  "px-3 py-2 text-[13.5px] text-ink dark:text-cream/90 placeholder:text-ink-faint " +
  "dark:placeholder:text-cream/40 outline-none focus:border-ink/25 dark:focus:border-white/25";
const LABEL = "block text-[11px] font-semibold tracking-[0.1em] uppercase text-ink-faint mb-1";
const ICON_BUTTON =
  "w-7 h-7 shrink-0 grid place-items-center rounded-lg text-ink-faint " +
  "hover:text-ink-soft dark:hover:text-cream/70 disabled:opacity-30 disabled:cursor-not-allowed";

/** Ein Zahlenfeld der Kennzahlen-Reihe. */
function NumberField({
  label,
  value,
  suffix,
  onChange,
}: {
  label: string;
  value: string;
  suffix?: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className={LABEL}>
        {label}
        {suffix ? ` (${suffix})` : ""}
      </span>
      <input
        type="number"
        inputMode="numeric"
        min={0}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={FIELD}
      />
    </label>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[13.5px] text-ink dark:text-cream/85">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="w-4 h-4 accent-dome-deep"
      />
      {label}
    </label>
  );
}

export function RecipeEditor({ recipe }: { recipe?: Recipe }) {
  const router = useRouter();
  const [draft, setDraft] = useState<RecipeDraft>(() =>
    recipe ? draftFromRecipe(recipe) : emptyDraft(),
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof RecipeDraft>(key: K, value: RecipeDraft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setIngredients = (next: RecipeDraftIngredient[]) => set("ingredients", next);

  const editIngredient = (index: number, patch: Partial<RecipeDraftIngredient>) =>
    setIngredients(draft.ingredients.map((i, n) => (n === index ? { ...i, ...patch } : i)));

  const removeIngredient = (index: number) => {
    const next = draft.ingredients.filter((_, n) => n !== index);
    setIngredients(next.length > 0 ? next : [{ ...EMPTY_INGREDIENT }]);
  };

  const save = () => {
    const problem = draftError(draft);
    if (problem) {
      setError(problem);
      return;
    }
    setError(null);
    setSaving(true);
    const input = draftToInput(draft);
    startTransition(async () => {
      try {
        let id = recipe?.id;
        if (recipe) await updateRecipeAction(recipe.id, input);
        else id = (await createRecipeAction(input)).id;
        router.push(`${RECIPES_PATH}/${id}`);
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Speichern fehlgeschlagen.");
        setSaving(false);
      }
    });
  };

  const cancelHref = recipe ? `${RECIPES_PATH}/${recipe.id}` : RECIPES_PATH;

  return (
    <div className="space-y-4">
      <label className="block">
        <span className={LABEL}>Name</span>
        <input
          type="text"
          value={draft.name}
          onChange={(e) => set("name", e.target.value)}
          placeholder="Kokos-Curry"
          className={FIELD}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="block">
          <span className={LABEL}>Bewertung</span>
          <select
            value={draft.rating}
            onChange={(e) => set("rating", e.target.value)}
            className={FIELD}
          >
            {RATINGS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <NumberField label="Portionen" value={draft.servings} onChange={(v) => set("servings", v)} />
      </div>

      <div className="flex items-center gap-4">
        <Toggle label="einfach" checked={draft.simple} onChange={(v) => set("simple", v)} />
        <Toggle
          label="aufwärmbar"
          checked={draft.reheatable}
          onChange={(v) => set("reheatable", v)}
        />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <NumberField
          label="Vorbereitung"
          suffix="min"
          value={draft.prepMinutes}
          onChange={(v) => set("prepMinutes", v)}
        />
        <NumberField
          label="Kochzeit"
          suffix="min"
          value={draft.cookMinutes}
          onChange={(v) => set("cookMinutes", v)}
        />
        <NumberField
          label="kcal"
          suffix="pro Portion"
          value={draft.kcal}
          onChange={(v) => set("kcal", v)}
        />
        <NumberField
          label="Eiweiß"
          suffix="g/Portion"
          value={draft.protein}
          onChange={(v) => set("protein", v)}
        />
      </div>

      <label className="block">
        <span className={LABEL}>Tags</span>
        <input
          type="text"
          value={draft.tags}
          onChange={(e) => set("tags", e.target.value)}
          placeholder="curry, vegetarisch"
          className={FIELD}
        />
      </label>

      <section className="space-y-2">
        <div className="flex items-center justify-between">
          <span className={`${LABEL} mb-0`}>Zutaten</span>
          <button
            type="button"
            onClick={() => setIngredients([...draft.ingredients, { ...EMPTY_INGREDIENT }])}
            className="inline-flex items-center gap-1 text-[11.5px] font-semibold px-2.5 py-1 rounded-full
                       bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                       hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
          >
            <Plus size={12} strokeWidth={2.4} />
            Zeile
          </button>
        </div>

        <ul className="space-y-1.5">
          {draft.ingredients.map((ingredient, index) => (
            <li key={index} className="flex items-center gap-1">
              <input
                type="text"
                value={ingredient.amount}
                onChange={(e) => editIngredient(index, { amount: e.target.value })}
                placeholder="400"
                aria-label={`Menge Zutat ${index + 1}`}
                className={`${FIELD} w-16 shrink-0 px-2`}
              />
              <input
                type="text"
                value={ingredient.unit}
                onChange={(e) => editIngredient(index, { unit: e.target.value })}
                placeholder="ml"
                aria-label={`Einheit Zutat ${index + 1}`}
                className={`${FIELD} w-16 shrink-0 px-2`}
              />
              <input
                type="text"
                value={ingredient.name}
                onChange={(e) => editIngredient(index, { name: e.target.value })}
                placeholder="Kokosmilch"
                aria-label={`Name Zutat ${index + 1}`}
                className={`${FIELD} flex-1 min-w-0`}
              />
              <button
                type="button"
                onClick={() => setIngredients(moveItem(draft.ingredients, index, index - 1))}
                disabled={index === 0}
                aria-label={`Zutat ${index + 1} nach oben`}
                className={ICON_BUTTON}
              >
                <ArrowUp size={14} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => setIngredients(moveItem(draft.ingredients, index, index + 1))}
                disabled={index === draft.ingredients.length - 1}
                aria-label={`Zutat ${index + 1} nach unten`}
                className={ICON_BUTTON}
              >
                <ArrowDown size={14} strokeWidth={2.2} />
              </button>
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                aria-label={`Zutat ${index + 1} entfernen`}
                className={`${ICON_BUTTON} hover:text-rose-500`}
              >
                <X size={14} strokeWidth={2.2} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <label className="block">
        <span className={LABEL}>Zubereitung — ein Schritt pro Zeile</span>
        <textarea
          value={draft.steps}
          onChange={(e) => set("steps", e.target.value)}
          rows={7}
          placeholder={"Zwiebeln anschwitzen.\nKokosmilch zugeben und 20 Min köcheln."}
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Notizen</span>
        <textarea
          value={draft.notes}
          onChange={(e) => set("notes", e.target.value)}
          rows={3}
          placeholder="Mit Naan servieren."
          className={`${FIELD} resize-y`}
        />
      </label>

      <label className="block">
        <span className={LABEL}>Quelle</span>
        <input
          type="url"
          inputMode="url"
          value={draft.sourceUrl}
          onChange={(e) => set("sourceUrl", e.target.value)}
          placeholder="https://…"
          className={FIELD}
        />
      </label>

      {error && <p className="text-[12.5px] text-amber-700 dark:text-amber-300">{error}</p>}

      <div className="flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="flex-1 rounded-xl bg-ink text-cream dark:bg-cream dark:text-ink
                     font-semibold text-[14px] py-2.5 disabled:opacity-50 disabled:cursor-wait"
        >
          {saving ? "speichere …" : "Speichern"}
        </button>
        <button
          type="button"
          onClick={() => router.push(cancelHref)}
          className="px-4 py-2.5 rounded-xl text-[14px] font-semibold
                     bg-cream/70 dark:bg-white/[0.06] text-ink-soft dark:text-cream/70
                     hover:bg-cream dark:hover:bg-white/[0.1] transition-colors"
        >
          Abbrechen
        </button>
      </div>
    </div>
  );
}
