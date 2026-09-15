// Bring! integration (Phase 7) — pushes the dashboard's open shopping items to
// the shared Bring! list via the unofficial REST API (wrapped by the
// zero-dependency `bring-shopping` package; see the feasibility spike at
// `docs/spikes/2026-06-07-bring-machbarkeit.md`).
//
// Split into pure mappers (env/network-free, unit-tested) and a thin network
// wrapper (not unit-tested — would hit Bring's servers), mirroring
// `@/integrations/weather/openMeteo` and `@/integrations/calendar/google`.
//
// Direction is dashboard → Bring only (one-way push); the spike found the
// *write* path ("add item") far more stable than Bring's *read* paths, which
// keep gaining new, unannounced response fields.

import Bring from "bring-shopping";

/** Push-ready item — `name` maps to Bring's `itemName`, `spec` to its optional description line. */
export interface BringItem {
  name: string;
  spec?: string;
}

export type BringPushResult = { ok: true; pushed: number } | { ok: false; error: string };

/**
 * Maps shopping items to Bring push items — pure, no network/env access.
 * Only items still open (`done: false`) are pushed; items the household has
 * already checked off don't belong on Bring's list.
 */
export function toBringItems(items: { text: string; done: boolean; spec?: string | null }[]): BringItem[] {
  return items
    .filter((item) => !item.done)
    .map((item) => (item.spec ? { name: item.text, spec: item.spec } : { name: item.text }));
}

/**
 * Übersetzt eine Antwort von `saveItem` in eine Fehlermeldung — pure.
 *
 * `bring-shopping@2.0.1` prüft beim Speichern den HTTP-Status NICHT: bei 401
 * (abgelaufenes Token) oder 4xx liefert `saveItem` den Fehler-Body zurück,
 * statt zu werfen. Ohne diese Prüfung meldet der Push Erfolg, obwohl auf der
 * Bring-Liste nichts ankommt. Erfolg ist HTTP 204 mit leerem Body.
 */
export function bringErrorMessage(responseBody: string): string | null {
  const body = responseBody.trim();
  if (body === "") return null;
  try {
    const parsed: unknown = JSON.parse(body);
    if (parsed && typeof parsed === "object") {
      const { message, error } = parsed as { message?: unknown; error?: unknown };
      if (typeof message === "string" && message !== "") return message;
      if (typeof error === "string" && error !== "") return error;
    }
  } catch {
    // Kein JSON — dann ist der Rohtext die beste Meldung.
  }
  return body;
}

/**
 * Verbindet die Mengenangabe eines bereits auf Bring stehenden Eintrags mit der
 * neu gepushten — pure. Bring kennt jeden Artikel nur einmal und ÜBERSCHREIBT
 * beim Speichern die Beschreibung eines gleichnamigen Eintrags. Steht dort
 * schon etwas anderes (von Hand eingetragen oder aus einem früheren Push),
 * hängen wir unsere Menge an, statt sie zu ersetzen.
 */
export function mergeSpec(existing: string | undefined, next: string | undefined): string {
  const current = (existing ?? "").trim();
  const added = (next ?? "").trim();
  if (current === "") return added;
  if (added === "" || current === added) return current;
  if (current.split(" + ").includes(added)) return current;
  return `${current} + ${added}`;
}

/** Schlüssel für den Mengen-Abgleich: Bring vergleicht Artikelnamen unabhängig von Schreibweise. */
const specKey = (name: string) => name.trim().toLowerCase();

/**
 * Cached, logged-in client (module-level — survives across requests within
 * the same server process). Avoids repeated `login()` calls, which the spike
 * flagged as a rate-limit risk (Bring! Issue #305).
 */
let session: Bring | null = null;

async function getSession(email: string, password: string): Promise<Bring> {
  if (session) return session;
  const bring = new Bring({ mail: email, password });
  await bring.login();
  session = bring;
  return bring;
}

/**
 * Liest die offenen Einträge der Liste als `name → spec`. Wirft bei
 * abgelaufener Sitzung (`getItems` prüft den Fehler-Body, anders als
 * `saveItem`) und dient deshalb zugleich als Sitzungs-Check vor dem Push.
 */
async function loadSpecs(bring: Bring, listUuid: string): Promise<Map<string, string>> {
  const items = await bring.getItems(listUuid);
  return new Map(items.purchase.map((i) => [specKey(i.name), i.specification ?? ""]));
}

/**
 * Speichert einen Eintrag und liefert die Fehlermeldung oder `null`.
 * Name und Beschreibung müssen kodiert rein: `bring-shopping` setzt beide roh
 * in den Form-Body, sonst zerlegt ein `&` im Namen ("Salz & Pfeffer") die
 * Anfrage und nur der Teil davor kommt an.
 */
async function saveItem(bring: Bring, listUuid: string, name: string, spec: string): Promise<string | null> {
  return bringErrorMessage(await bring.saveItem(listUuid, encodeURIComponent(name), encodeURIComponent(spec)));
}

/**
 * Pushes `items` to the configured Bring! list (`BRING_EMAIL`/`BRING_PASSWORD`/
 * `BRING_LIST_UUID` from `.env`). NOT unit-tested (network I/O) — `toBringItems`,
 * `bringErrorMessage` und `mergeSpec` tragen die getestete Logik.
 *
 * Fügt nur hinzu: bestehende Einträge der Liste werden nie gelöscht, und die
 * Menge eines gleichnamigen Eintrags wird ergänzt statt überschrieben.
 *
 * Defensive by design (per the spike's risk findings): never throws — always
 * resolves to a `BringPushResult` so the caller (a Server Action) can show a
 * clear status and fall back to "copy the list manually" on failure. A failed
 * push drops the cached session so the next attempt re-authenticates (e.g.
 * after a token expiry or a transient Bring outage).
 */
export async function pushShoppingList(items: BringItem[]): Promise<BringPushResult> {
  const email = process.env.BRING_EMAIL;
  const password = process.env.BRING_PASSWORD;
  const listUuid = process.env.BRING_LIST_UUID;

  if (!email || !password || !listUuid) {
    return {
      ok: false,
      error: "Bring! ist nicht eingerichtet (BRING_EMAIL/BRING_PASSWORD/BRING_LIST_UUID fehlen in .env).",
    };
  }

  if (items.length === 0) {
    return { ok: true, pushed: 0 };
  }

  try {
    let bring = await getSession(email, password);
    let existing: Map<string, string> | null;
    try {
      existing = await loadSpecs(bring, listUuid);
    } catch {
      // Gecachte Sitzung abgelaufen (der Prozess am Tablet läuft wochenlang)
      // → einmal frisch anmelden. Bleibt das Lesen kaputt, pushen wir trotzdem;
      // dann ohne Mengen-Abgleich (das Schreiben ist der stabilere Pfad).
      session = null;
      bring = await getSession(email, password);
      existing = await loadSpecs(bring, listUuid).catch(() => null);
    }

    for (const item of items) {
      const spec = existing ? mergeSpec(existing.get(specKey(item.name)), item.spec) : (item.spec ?? "");
      const error = await saveItem(bring, listUuid, item.name, spec);
      if (error) {
        session = null;
        return { ok: false, error: `Bring!-Übertragung fehlgeschlagen bei „${item.name}“: ${error}` };
      }
    }
    return { ok: true, pushed: items.length };
  } catch (error) {
    session = null;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Bring!-Übertragung fehlgeschlagen: ${message}` };
  }
}
