// Bearer-Prüfung für die Import-Endpunkte. Zweiter Riegel hinter Cloudflare
// Access: Diese Routen geben Abo-Kontingent aus und schreiben in die DB —
// sie hängen bewusst nicht allein an einer korrekt gesetzten Cloudflare-Regel.
//
// Ohne konfigurierten Token antworten die Routen mit 503 statt ungeschützt zu
// laufen: Ein vergessener Env-Eintrag darf keinen offenen Endpunkt ergeben.

import { timingSafeEqual } from "node:crypto";

export type ImportAuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string };

/**
 * Zeitkonstanter Vergleich. `timingSafeEqual` wirft bei ungleicher Länge,
 * deshalb die Länge vorher prüfen — sonst würde ein zu kurzer Token einen
 * 500er auslösen statt eines 401ers. Die Länge selbst ist kein Geheimnis.
 */
function sameToken(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

export function checkImportToken(request: Request): ImportAuthResult {
  const expected = process.env.RECIPE_IMPORT_TOKEN;
  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: "Import-Endpunkt nicht konfiguriert (RECIPE_IMPORT_TOKEN fehlt).",
    };
  }

  const header = request.headers.get("authorization") ?? "";
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token || !sameToken(token, expected)) {
    return { ok: false, status: 401, error: "Nicht autorisiert." };
  }
  return { ok: true };
}
