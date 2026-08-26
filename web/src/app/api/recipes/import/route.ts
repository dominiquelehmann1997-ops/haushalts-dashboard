// POST /api/recipes/import — ein (ggf. im Client editiertes) ImportedRecipe in
// die DB schreiben. Derselbe Weg wie Link-Import und Claude-Rezeptideen:
// upsertImportedRecipe dedupliziert über Quell-URL bzw. Slug und lässt
// Bewertung, Notizen und Bild eines bestehenden Rezepts unangetastet.

import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";

import { checkImportToken } from "@/lib/api/importAuth";
import { revalidateDashboard } from "@/lib/revalidate";
import { upsertImportedRecipe } from "@/lib/repositories/recipes";
import { attachRecipeImage } from "@/lib/services/recipeImage";
import { slugFromName, type ImportedRecipe } from "@/lib/services/recipeImport";

export async function POST(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { recipe?: ImportedRecipe };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  const recipe = body?.recipe;
  if (!recipe || typeof recipe.name !== "string" || recipe.name.trim() === "") {
    return NextResponse.json({ ok: false, error: "Rezept ohne Namen." }, { status: 400 });
  }
  if (!Array.isArray(recipe.ingredients) || recipe.ingredients.length === 0) {
    return NextResponse.json({ ok: false, error: "Rezept ohne Zutaten." }, { status: 400 });
  }

  // Der Client darf den Slug leer lassen — bei einem frisch abfotografierten
  // Rezept gibt es keine Vorgeschichte, aus der er stammen könnte.
  const slug = recipe.slug?.trim() || slugFromName(recipe.name);
  if (slug === "") {
    // slugFromName wirft Namen weg, die nur aus Symbolen/Emoji bestehen —
    // ohne diese Prüfung würden alle solchen Rezepte denselben (leeren)
    // Slug teilen und sich in findImportMatch gegenseitig überschreiben.
    return NextResponse.json(
      { ok: false, error: "Rezeptname ergibt keinen gültigen Slug." },
      { status: 400 },
    );
  }

  try {
    const { id, name, updated } = await upsertImportedRecipe({ ...recipe, slug });
    await attachRecipeImage(id, recipe.imageUrl ?? null);
    revalidateDashboard();
    revalidatePath("/mobile/meals/rezepte/[id]", "page");
    return NextResponse.json({ ok: true, id, name, updated });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Speichern fehlgeschlagen." },
      { status: 500 },
    );
  }
}
