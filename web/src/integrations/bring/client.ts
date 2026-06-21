// Bring! integration (Phase 7) — pushes the dashboard's open shopping items to
// the shared Bring! list via the unofficial REST API (wrapped by the
// zero-dependency `bring-shopping` package; see the feasibility spike at
// `docs/spikes/2026-06-07-bring-machbarkeit.md`).
//
// Split into a pure mapper (env/network-free, unit-tested) and a thin network
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
 *
 * When `amount` is present, it is passed as Bring's `spec` (the optional
 * description/note line shown below the item name).
 */
export function toBringItems(
  items: { text: string; done: boolean; amount?: string | null; unit?: string | null }[],
): BringItem[] {
  return items.filter((item) => !item.done).map((item) => {
    const spec = item.amount
      ? item.unit
        ? `${item.amount} ${item.unit}`
        : item.amount
      : undefined;
    return { name: item.text, ...(spec !== undefined ? { spec } : {}) };
  });
}

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
 * Pushes `items` to the configured Bring! list (`BRING_EMAIL`/`BRING_PASSWORD`/
 * `BRING_LIST_UUID` from `.env`). NOT unit-tested (network I/O) — `toBringItems`
 * carries the tested logic.
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
    const bring = await getSession(email, password);
    for (const item of items) {
      await bring.saveItem(listUuid, item.name, item.spec ?? "");
    }
    return { ok: true, pushed: items.length };
  } catch (error) {
    session = null;
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `Bring!-Übertragung fehlgeschlagen: ${message}` };
  }
}
