// POST /api/recipes/parse — Rohtext (OCR, Social-Caption) oder Rezept-Link zu
// einem ImportedRecipe machen. Schreibt NICHTS in die DB: ObsidiDine zeigt das
// Ergebnis erst im eigenen Editor, gespeichert wird über /api/recipes/import.
//
// Ein Link mit schema.org-Markup läuft ohne LLM durch (recipeImport.ts) — das
// ist schneller, genauer und kostet kein Abo-Kontingent. Erst wenn das nicht
// greift, übernimmt die Extraktion.

import { NextResponse } from "next/server";

import { checkImportToken } from "@/lib/api/importAuth";
import { extractRecipeFromText } from "@/lib/services/recipeExtract";
import { importRecipeFromUrl } from "@/lib/services/recipeImport";

export async function POST(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { text?: unknown; sourceUrl?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Body ist kein JSON." }, { status: 400 });
  }

  const text = typeof body?.text === "string" ? body.text : "";
  const sourceUrl =
    typeof body?.sourceUrl === "string" && body.sourceUrl ? body.sourceUrl : null;
  if (text.trim() === "" && !sourceUrl) {
    return NextResponse.json(
      { ok: false, error: "Weder Text noch Quell-URL übergeben." },
      { status: 400 },
    );
  }

  try {
    // Reiner Link ohne Text: erst der günstige Weg über das Seiten-Markup.
    if (sourceUrl && text.trim() === "") {
      try {
        return NextResponse.json({ ok: true, recipe: await importRecipeFromUrl(sourceUrl) });
      } catch {
        return NextResponse.json(
          {
            ok: false,
            error:
              "Die Seite liefert keine Rezeptdaten. Teile stattdessen den Text oder einen Screenshot.",
          },
          { status: 422 },
        );
      }
    }
    return NextResponse.json({ ok: true, recipe: await extractRecipeFromText(text, sourceUrl) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Extraktion fehlgeschlagen." },
      { status: 502 },
    );
  }
}
