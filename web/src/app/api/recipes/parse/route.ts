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
import { importRecipeFromUrl, type ImportedRecipe } from "@/lib/services/recipeImport";

const LINK_IMPORT_ERROR_MESSAGE =
  "Die Seite liefert keine Rezeptdaten. Teile stattdessen den Text oder einen Screenshot.";

/** Markiert einen fehlgeschlagenen Link-Import, damit der synchrone Weg dafür
 *  gezielt mit 422 statt 502 antworten kann. */
class LinkImportError extends Error {
  constructor() {
    super(LINK_IMPORT_ERROR_MESSAGE);
  }
}

/**
 * Text oder Link zu einem Rezept. Reiner Link ohne Text läuft über den
 * günstigen Weg (Seiten-Markup, kein Abo-Kontingent); scheitert der, gibt es
 * gezielt die verständliche Meldung statt der Roh-Exception — sonst sieht der
 * Nutzer beim Teilen eines Links ohne schema.org-Markup nur Technik-Kauderwelsch.
 * Von synchronem und asynchronem Weg gleichermaßen genutzt, damit beide
 * dieselbe Fehlerbehandlung bekommen.
 */
async function resolveRecipe(text: string, sourceUrl: string | null): Promise<ImportedRecipe> {
  if (sourceUrl && text.trim() === "") {
    try {
      return await importRecipeFromUrl(sourceUrl);
    } catch {
      throw new LinkImportError();
    }
  }
  return extractRecipeFromText(text, sourceUrl);
}

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
    return NextResponse.json({ ok: true, recipe: await resolveRecipe(text, sourceUrl) });
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: e instanceof Error ? e.message : "Extraktion fehlgeschlagen." },
      { status: e instanceof LinkImportError ? 422 : 502 },
    );
  }
}

/**
 * Läuft absichtlich ohne `await` weiter, nachdem die Route schon geantwortet
 * hat. Wirft nie — jeder Fehler landet als Text im Job.
 */
async function runExtraction(jobId: string, text: string, sourceUrl: string | null) {
  try {
    finishJob(jobId, await resolveRecipe(text, sourceUrl));
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
