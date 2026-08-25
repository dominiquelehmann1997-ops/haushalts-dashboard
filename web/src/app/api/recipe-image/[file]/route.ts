// GET /api/recipe-image/<datei> — liefert ein Rezeptbild aus RECIPE_IMAGE_DIR.
//
// Die Bilder liegen außerhalb des Repos (siehe recipeImage.ts), können also
// nicht aus `public/` kommen. Dieser Handler ist damit der einzige Weg nach
// draußen — und die einzige Stelle, an der ein Dateiname aus einer URL auf das
// Dateisystem trifft: `isSafeImageFile` lässt nur die Namen durch, die der
// Downloader selbst vergibt (kein `..`, keine Pfadtrenner).
//
// Alles Unbekannte wird zu 404, auch ein abgewiesener Name: ob eine Datei
// existiert, geht den Aufrufer nichts an.

import { readFile } from "node:fs/promises";
import path from "node:path";

import { contentTypeForImage, isSafeImageFile, recipeImageDir } from "@/lib/services/recipeImage";

export const dynamic = "force-dynamic";

function notFound(): Response {
  return new Response("Not found", { status: 404 });
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ file: string }> },
): Promise<Response> {
  const { file } = await params;
  const name = decodeURIComponent(file);

  if (!isSafeImageFile(name)) return notFound();

  const contentType = contentTypeForImage(name);
  if (!contentType) return notFound();

  const dir = recipeImageDir();
  if (!dir) return notFound();

  let bytes: Buffer;
  try {
    bytes = await readFile(path.join(dir, name));
  } catch {
    return notFound();
  }

  return new Response(new Uint8Array(bytes), {
    headers: {
      "content-type": contentType,
      // Eine Stunde: der Dateiname bleibt beim Re-Import gleich, ein
      // ausgetauschtes Bild soll aber nicht ewig hängenbleiben.
      "cache-control": "public, max-age=3600",
    },
  });
}
