// Rezeptbilder: das Bild aus den schema.org-Daten einmalig laden, unter
// RECIPE_IMAGE_DIR ablegen und den Dateinamen ans Rezept hängen.
//
// Die Bilder liegen bewusst **außerhalb** von `public/`: auf dem Tablet nimmt
// ein Redeploy den Repo-Ordner mit, und die Bilder sollen das überleben.
// Ausgeliefert werden sie über den Route-Handler `/api/recipe-image/[file]`.
//
// Der Dateityp wird an den ersten Bytes erkannt, nicht am `Content-Type` der
// Antwort: Rezeptseiten liefern gerne eine HTML-Fehlerseite mit Status 200 und
// falschem Header. Was sich nicht als Bild lesen lässt, wird nicht gespeichert.
//
// Ein Fehlschlag ist nie fatal — ein Rezept ohne Bild ist ein vollständiges
// Rezept. Die reine Logik (Sniffing, Dateinamen) ist getestet; Fetch und
// Datei-Write sind dünne Integrations-Wrapper.

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { getRecipe, setRecipeImage } from "@/lib/repositories/recipes";

/**
 * Obergrenze pro Bild. Rezept-Titelbilder liegen real bei 100–600 kB; 3 MB
 * lassen genug Luft und verhindern trotzdem, dass eine Seite den Tablet-
 * Speicher vollschreibt.
 */
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;

/** Die Formate, die wir speichern und wieder ausliefern. */
const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  avif: "image/avif",
};

/** Prüft eine ASCII-Signatur an fester Position. */
function hasAscii(bytes: Uint8Array, offset: number, text: string): boolean {
  if (bytes.length < offset + text.length) return false;
  for (let i = 0; i < text.length; i += 1) {
    if (bytes[offset + i] !== text.charCodeAt(i)) return false;
  }
  return true;
}

function startsWithBytes(bytes: Uint8Array, signature: number[]): boolean {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

/**
 * Dateiendung anhand der Magic Bytes — `null`, wenn das keins der
 * unterstützten Bildformate ist.
 */
export function sniffImageExtension(bytes: Uint8Array): string | null {
  if (startsWithBytes(bytes, [0xff, 0xd8, 0xff])) return "jpg";
  if (startsWithBytes(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (hasAscii(bytes, 0, "GIF87a") || hasAscii(bytes, 0, "GIF89a")) return "gif";
  if (hasAscii(bytes, 0, "RIFF") && hasAscii(bytes, 8, "WEBP")) return "webp";
  // AVIF: ISO-BMFF-Box "ftyp" mit Marke "avif" (Einzelbild) bzw. "avis" (Sequenz).
  if (hasAscii(bytes, 4, "ftypavif") || hasAscii(bytes, 4, "ftypavis")) return "avif";
  return null;
}

/**
 * Dateiname → MIME-Typ für den Route-Handler; `null` bei allem, was wir nicht
 * ausliefern.
 */
export function contentTypeForImage(file: string): string | null {
  const ext = file.slice(file.lastIndexOf(".") + 1).toLowerCase();
  return CONTENT_TYPES[ext] ?? null;
}

/**
 * Torwächter des Route-Handlers: nur Dateinamen, wie `imageFileName` sie
 * erzeugt. Das schließt Pfadtrenner, `..` und alles außerhalb von
 * RECIPE_IMAGE_DIR aus — der Handler liest sonst beliebige Dateien vom Tablet.
 */
export function isSafeImageFile(name: string): boolean {
  return /^[a-z0-9][a-z0-9-]*\.(jpg|png|gif|webp|avif)$/.test(name);
}

/** Rezept-Slug + Endung → Dateiname. */
export function imageFileName(slug: string, extension: string): string | null {
  const name = `${slug}.${extension}`;
  return isSafeImageFile(name) ? name : null;
}

/**
 * Liest den Antwort-Body, bricht aber bei `max` Bytes ab. Bewusst nicht
 * `response.arrayBuffer()`: das lädt erst alles in den Speicher und fragt
 * hinterher nach der Größe. `Content-Length` allein reicht nicht — der Header
 * fehlt bei Chunked-Antworten oder lügt.
 */
export async function readCapped(
  response: Response,
  max = MAX_IMAGE_BYTES,
): Promise<Uint8Array | null> {
  const reader = response.body?.getReader();
  if (!reader) return null;

  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }

  const out = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
}

// ---- Integration (ungetestet, dünn) ----

/** Ablageort der Bilder; `null` = nicht konfiguriert, dann bleibt alles bildlos. */
export function recipeImageDir(): string | null {
  const dir = process.env.RECIPE_IMAGE_DIR?.trim();
  return dir ? dir : null;
}

const IMAGE_TIMEOUT_MS = 15_000;

/**
 * Lädt das Bild und legt es als `<slug>.<ext>` ab. Gibt den Dateinamen zurück
 * oder `null`, wenn irgendetwas daran nicht klappt.
 */
export async function downloadRecipeImage(url: string, slug: string): Promise<string | null> {
  const dir = recipeImageDir();
  if (!dir) return null;

  try {
    const response = await fetch(url, {
      headers: { accept: "image/*" },
      signal: AbortSignal.timeout(IMAGE_TIMEOUT_MS),
    });
    if (!response.ok) return null;

    const bytes = await readCapped(response);
    if (!bytes) return null;

    const extension = sniffImageExtension(bytes);
    if (!extension) return null;

    const file = imageFileName(slug, extension);
    if (!file) return null;

    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, file), bytes);
    return file;
  } catch {
    return null; // Netzfehler, Timeout, volle Platte — nie fatal
  }
}

/**
 * Hängt einem frisch importierten Rezept sein Bild an — aber nur, wenn es noch
 * keins hat. Ein erneuter Import überschreibt das Bild also nicht, genau wie
 * er Bewertung und Notizen in Ruhe lässt (siehe `upsertImportedRecipe`).
 *
 * Der Dateiname kommt aus dem **gespeicherten** Slug, nicht aus dem der
 * Importquelle: den vergibt der Upsert nur, wenn er noch frei ist. Ein Rezept
 * ohne Slug bekommt seine id — sonst könnten sich zwei Rezepte dieselbe
 * Bilddatei überschreiben.
 */
export async function attachRecipeImage(
  recipeId: string,
  imageUrl: string | null,
): Promise<string | null> {
  if (!imageUrl || !recipeImageDir()) return null;

  const recipe = await getRecipe(recipeId);
  if (!recipe || recipe.imageUrl) return null;

  const file = await downloadRecipeImage(imageUrl, recipe.slug ?? recipe.id);
  if (!file) return null;

  await setRecipeImage(recipeId, file);
  return file;
}
