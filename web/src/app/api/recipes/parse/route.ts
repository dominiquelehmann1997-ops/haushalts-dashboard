// POST /api/recipes/parse — Rohtext (OCR, Social-Caption) oder Rezept-Link zu
// einem ImportedRecipe machen. Schreibt NICHTS in die DB: ObsidiDine zeigt das
// Ergebnis erst im eigenen Editor, gespeichert wird über /api/recipes/import.
//
// Ein Link mit schema.org-Markup läuft ohne LLM durch (recipeImport.ts) — das
// ist schneller, genauer und kostet kein Abo-Kontingent. Erst wenn das nicht
// greift, übernimmt die Extraktion.

import { NextResponse } from "next/server";

import { checkImportToken } from "@/lib/api/importAuth";
import { createJob, failJob, finishJob, readJob } from "@/lib/services/importJobs";
import { extractRecipeFromText } from "@/lib/services/recipeExtract";
import { importRecipeFromUrl } from "@/lib/services/recipeImport";

export async function POST(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  let body: { text?: unknown; sourceUrl?: unknown; async?: unknown };
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

  // Asynchron: Job anlegen, sofort antworten, im Hintergrund extrahieren. So
  // dauert kein einzelner Request länger als Millisekunden — das ~100s-Limit
  // der Cloudflare-Edge kann nicht mehr greifen.
  if (body?.async === true) {
    const jobId = createJob();
    void runExtraction(jobId, text, sourceUrl);
    return NextResponse.json({ ok: true, jobId }, { status: 202 });
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

/**
 * Läuft absichtlich ohne `await` weiter, nachdem die Route schon geantwortet
 * hat. Wirft nie — jeder Fehler landet als Text im Job.
 */
async function runExtraction(jobId: string, text: string, sourceUrl: string | null) {
  try {
    const recipe =
      sourceUrl && text.trim() === ""
        ? await importRecipeFromUrl(sourceUrl)
        : await extractRecipeFromText(text, sourceUrl);
    finishJob(jobId, recipe);
  } catch (e) {
    failJob(jobId, e instanceof Error ? e.message : "Extraktion fehlgeschlagen.");
  }
}

export async function GET(request: Request) {
  const auth = checkImportToken(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const id = new URL(request.url).searchParams.get("job");
  const job = id ? readJob(id) : null;
  if (!job) {
    return NextResponse.json(
      { ok: false, error: "Job unbekannt oder abgelaufen." },
      { status: 404 },
    );
  }
  // Der Status steht im Body, nicht im HTTP-Code: ein laufender Job ist kein
  // Fehler, und der DashboardClient wirft bei jedem non-2xx.
  return NextResponse.json({ ok: true, ...job });
}
