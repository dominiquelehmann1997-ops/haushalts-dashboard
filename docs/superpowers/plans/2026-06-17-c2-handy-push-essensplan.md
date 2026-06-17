# C2 Handy-Push (Essensplan-Entwurf) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wenn ein Essensplan-Entwurf entsteht, bekommen Dome & Emely eine Web-Push-Benachrichtigung aufs Handy; Antippen öffnet die App beim Entwurf.

**Architecture:** Schichten wie im Bestand: Prisma-Modell `PushSubscription` → Repository (`client`-parametrisiert, testbar) → Service `pushNotify` (sendet via `web-push`, non-fatal, selbstheilend bei 410/404) → dünne Server Actions → Client-Knopf + Service-Worker-Handler. Versand wird in `generatePlanAction` nach der Entwurfserzeugung eingehängt.

**Tech Stack:** Next.js 16.2.7 (Server Actions), React 19, Prisma 7 + better-sqlite3, `web-push` (neu), Vitest 4.

## Global Constraints

- **Worktree-Pflicht** (`web/AGENTS.md`): NICHT direkt auf `main`/`Dashboard/web` entwickeln. Diese Arbeit läuft in einem isolierten git-worktree mit eigener `.env` + isolierter `dev.db`. Migrationen dürfen NIE die Produktions-DB berühren.
- **Next-Version hat Breaking Changes** (`web/AGENTS.md`): vor Code die relevanten Guides unter `node_modules/next/dist/docs/` lesen (Server Actions, Conventions).
- **Tests:** Vitest, `npm test` = `vitest run`. Repo/Service-Tests nutzen `createTestClient` + `resetDatabase` aus `@/test/db`; Dateien laufen sequentiell (`fileParallelism: false`).
- **Prisma-Client-Import:** `import { prisma } from "@/lib/db"`, Typ `import { PrismaClient } from "@/generated/prisma/client"`. Repos/Services nehmen `client: PrismaClient = prisma` als letztes Argument.
- **Versand non-fatal:** Push-Fehler oder 0 angemeldete Geräte dürfen die Entwurfserzeugung NIE scheitern lassen.
- **Notification-Texte (verbatim):** Titel `Essensplan-Entwurf bereit 🍽️`, Body `Antippen zum Abnicken oder Ändern.`, Klick-Ziel `/`.
- **personKey-Werte:** `"dome"` | `"emely"` (String, kein FK — konsistent mit `Person.key`).

---

### Task 1: `PushSubscription`-Modell, Migration & Repository

**Files:**
- Modify: `web/prisma/schema.prisma` (neues Modell ans Ende)
- Modify: `web/prisma/seed.ts:63-74` (Wipe-Block — `pushSubscription.deleteMany()` ergänzen)
- Create: `web/src/lib/repositories/pushSubscriptions.ts`
- Test: `web/src/lib/repositories/pushSubscriptions.test.ts`
- Migration (generiert): `web/prisma/migrations/<ts>_push_subscription/`

**Interfaces:**
- Produces:
  - `upsertSubscription(input: PushSubscriptionInput, client?: PrismaClient): Promise<void>` — Upsert by `endpoint`.
  - `deleteSubscription(endpoint: string, client?: PrismaClient): Promise<void>`
  - `getAllSubscriptions(client?: PrismaClient): Promise<StoredSubscription[]>`
  - `interface PushSubscriptionInput { personKey: string; endpoint: string; p256dh: string; auth: string; }`
  - `interface StoredSubscription { endpoint: string; p256dh: string; auth: string; personKey: string; }`

- [ ] **Step 1: Modell in `schema.prisma` ergänzen**

Ans Ende von `web/prisma/schema.prisma` anhängen:

```prisma
model PushSubscription {
  id        String   @id @default(cuid())
  personKey String // "dome" | "emely"
  endpoint  String   @unique
  p256dh    String
  auth      String
  createdAt DateTime @default(now())
}
```

- [ ] **Step 2: Wipe in `seed.ts` ergänzen**

In `web/prisma/seed.ts` im Wipe-Block (nach `await prisma.person.deleteMany();`, Zeile ~74) ergänzen:

```ts
  await prisma.pushSubscription.deleteMany();
```

- [ ] **Step 3: Migration erstellen + Client regenerieren**

Run: `npx prisma migrate dev --name push_subscription`
Expected: Migration `<ts>_push_subscription` angelegt, auf die (worktree-isolierte) `dev.db` angewandt, Prisma-Client neu generiert. KEINE Berührung der Produktions-DB.

- [ ] **Step 4: Failing Test schreiben**

`web/src/lib/repositories/pushSubscriptions.test.ts`:

```ts
import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import {
  deleteSubscription,
  getAllSubscriptions,
  upsertSubscription,
} from "./pushSubscriptions";

describe("pushSubscriptions repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  const sub = { personKey: "dome", endpoint: "https://push.example/abc", p256dh: "key1", auth: "auth1" };

  it("inserts a new subscription", async () => {
    await upsertSubscription(sub, client);
    const all = await getAllSubscriptions(client);
    expect(all).toEqual([{ endpoint: sub.endpoint, p256dh: "key1", auth: "auth1", personKey: "dome" }]);
  });

  it("upserts by endpoint — re-subscribing the same device does not duplicate and updates fields", async () => {
    await upsertSubscription(sub, client);
    await upsertSubscription({ ...sub, personKey: "emely", p256dh: "key2", auth: "auth2" }, client);
    const all = await getAllSubscriptions(client);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ endpoint: sub.endpoint, p256dh: "key2", auth: "auth2", personKey: "emely" });
  });

  it("deletes a subscription by endpoint", async () => {
    await upsertSubscription(sub, client);
    await deleteSubscription(sub.endpoint, client);
    expect(await getAllSubscriptions(client)).toEqual([]);
  });
});
```

- [ ] **Step 5: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/repositories/pushSubscriptions.test.ts`
Expected: FAIL — `./pushSubscriptions` existiert nicht.

- [ ] **Step 6: Repository implementieren**

`web/src/lib/repositories/pushSubscriptions.ts`:

```ts
import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

export interface PushSubscriptionInput {
  personKey: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  personKey: string;
}

/** Upsert by endpoint: re-subscribing the same device updates instead of duplicating. */
export async function upsertSubscription(
  input: PushSubscriptionInput,
  client: PrismaClient = prisma,
): Promise<void> {
  const { endpoint, personKey, p256dh, auth } = input;
  await client.pushSubscription.upsert({
    where: { endpoint },
    update: { personKey, p256dh, auth },
    create: { endpoint, personKey, p256dh, auth },
  });
}

export async function deleteSubscription(
  endpoint: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.pushSubscription.delete({ where: { endpoint } });
}

export async function getAllSubscriptions(
  client: PrismaClient = prisma,
): Promise<StoredSubscription[]> {
  const rows = await client.pushSubscription.findMany({
    select: { endpoint: true, p256dh: true, auth: true, personKey: true },
    orderBy: { createdAt: "asc" },
  });
  return rows;
}
```

- [ ] **Step 7: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/repositories/pushSubscriptions.test.ts`
Expected: PASS (3 Tests).

- [ ] **Step 8: Commit**

```bash
git add web/prisma/schema.prisma web/prisma/seed.ts web/prisma/migrations web/src/generated web/src/lib/repositories/pushSubscriptions.ts web/src/lib/repositories/pushSubscriptions.test.ts
git commit -m "feat(push): PushSubscription model + repository (upsert by endpoint)"
```

---

### Task 2: `web-push`-Dependency + `pushNotify`-Service

**Files:**
- Modify: `web/package.json` (Dependencies — via npm install)
- Create: `web/src/lib/services/pushNotify.ts`
- Test: `web/src/lib/services/pushNotify.test.ts`

**Interfaces:**
- Consumes: `getAllSubscriptions`, `deleteSubscription` (Task 1).
- Produces:
  - `interface PushPayload { title: string; body: string; url: string; }`
  - `isPushConfigured(): boolean`
  - `sendToAdults(payload: PushPayload, client?: PrismaClient): Promise<void>` — non-fatal; löscht Abos bei 410/404.

- [ ] **Step 1: `web-push` installieren**

Run: `npm install web-push && npm install -D @types/web-push`
Expected: `web-push` in `dependencies`, `@types/web-push` in `devDependencies`.

- [ ] **Step 2: Failing Test schreiben**

`web/src/lib/services/pushNotify.test.ts`:

```ts
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { upsertSubscription, getAllSubscriptions } from "@/lib/repositories/pushSubscriptions";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));

import { isPushConfigured, sendToAdults } from "./pushNotify";

describe("pushNotify", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    sendNotification.mockResolvedValue({ statusCode: 201 });
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.org";
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  const payload = { title: "T", body: "B", url: "/" };

  it("is configured only when all VAPID vars are present", () => {
    expect(isPushConfigured()).toBe(true);
    delete process.env.VAPID_PRIVATE_KEY;
    expect(isPushConfigured()).toBe(false);
  });

  it("sends the JSON payload to every stored subscription", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/1", p256dh: "k1", auth: "a1" }, client);
    await upsertSubscription({ personKey: "emely", endpoint: "https://e/2", p256dh: "k2", auth: "a2" }, client);

    await sendToAdults(payload, client);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [subArg, bodyArg] = sendNotification.mock.calls[0];
    expect(subArg).toEqual({ endpoint: "https://e/1", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(bodyArg as string)).toEqual(payload);
  });

  it("deletes a subscription when the push service returns 410", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/gone", p256dh: "k", auth: "a" }, client);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));

    await sendToAdults(payload, client);

    expect(await getAllSubscriptions(client)).toEqual([]);
  });

  it("never throws when a send fails for a non-expiry reason and keeps the subscription", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/keep", p256dh: "k", auth: "a" }, client);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));

    await expect(sendToAdults(payload, client)).resolves.toBeUndefined();
    expect(await getAllSubscriptions(client)).toHaveLength(1);
  });

  it("is a no-op (no sends) when VAPID is not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/x", p256dh: "k", auth: "a" }, client);

    await sendToAdults(payload, client);

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 3: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/lib/services/pushNotify.test.ts`
Expected: FAIL — `./pushNotify` existiert nicht.

- [ ] **Step 4: Service implementieren**

`web/src/lib/services/pushNotify.ts`:

```ts
import webpush from "web-push";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { deleteSubscription, getAllSubscriptions } from "@/lib/repositories/pushSubscriptions";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** True only when all VAPID env vars are present. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let vapidConfigured = false;
function ensureVapid(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidConfigured = true;
}

/**
 * Sends the payload to every stored subscription. Non-fatal: catches all
 * errors so callers (e.g. draft generation) never fail because of push. Prunes
 * subscriptions the push service reports as gone (HTTP 410/404).
 */
export async function sendToAdults(
  payload: PushPayload,
  client: PrismaClient = prisma,
): Promise<void> {
  if (!isPushConfigured()) return;
  ensureVapid();

  const subs = await getAllSubscriptions(client);
  const body = JSON.stringify(payload);

  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          body,
        );
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 410 || status === 404) {
          await deleteSubscription(s.endpoint, client).catch(() => {});
        }
      }
    }),
  );
}
```

- [ ] **Step 5: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/lib/services/pushNotify.test.ts`
Expected: PASS (5 Tests).

- [ ] **Step 6: Commit**

```bash
git add web/package.json web/package-lock.json web/src/lib/services/pushNotify.ts web/src/lib/services/pushNotify.test.ts
git commit -m "feat(push): pushNotify service (web-push, non-fatal, self-healing on 410)"
```

---

### Task 3: Server Actions (subscribe/unsubscribe)

**Files:**
- Create: `web/src/app/actions/push.ts`

**Interfaces:**
- Consumes: `upsertSubscription`, `deleteSubscription` (Task 1).
- Produces:
  - `interface WebPushSubscriptionJSON { endpoint: string; keys: { p256dh: string; auth: string }; }`
  - `subscribePushAction(personKey: string, sub: WebPushSubscriptionJSON): Promise<void>`
  - `unsubscribePushAction(endpoint: string): Promise<void>`

> Hinweis: Dünne Wrapper über die in Task 1 getestete Repo-Logik (Upsert-by-endpoint ist dort abgedeckt). Keine eigene Testdatei — Actions binden nur die globale `prisma` an die Repo-Funktionen.

- [ ] **Step 1: Next-Guide lesen**

Vor dem Code: relevanten Server-Actions-Guide unter `web/node_modules/next/dist/docs/` öffnen (Breaking Changes ggü. Trainingsstand).

- [ ] **Step 2: Actions implementieren**

`web/src/app/actions/push.ts`:

```ts
"use server";

// Server Actions für die Web-Push-Geräteanmeldung (Roadmap C2). Dünne Wrapper
// über das pushSubscriptions-Repository; die Upsert-by-endpoint-Logik ist dort
// getestet.

import { deleteSubscription, upsertSubscription } from "@/lib/repositories/pushSubscriptions";

export interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Registers (or refreshes) this device's push subscription for a person. */
export async function subscribePushAction(
  personKey: string,
  sub: WebPushSubscriptionJSON,
): Promise<void> {
  await upsertSubscription({
    personKey,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
}

/** Removes this device's subscription. */
export async function unsubscribePushAction(endpoint: string): Promise<void> {
  await deleteSubscription(endpoint);
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (keine Fehler).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/actions/push.ts
git commit -m "feat(push): subscribe/unsubscribe server actions"
```

---

### Task 4: Service Worker — `push` + `notificationclick`

**Files:**
- Modify: `web/public/sw.js`
- Modify: `web/src/app/sw.test.ts` (Test "does not implement push" umdrehen + neue Assertions)

**Interfaces:**
- Consumes: Payload-Form `{ title, body, url }` (Task 2 `PushPayload`).

- [ ] **Step 1: Bestehende SW-Tests anpassen (failing)**

In `web/src/app/sw.test.ts` den Test `does not implement push notifications (out of scope)` ERSETZEN durch:

```ts
  it("implements push and notificationclick handlers", () => {
    expect(sw).toContain('addEventListener("push"');
    expect(sw).toContain('addEventListener("notificationclick"');
    expect(sw).toContain("showNotification");
  });
```

- [ ] **Step 2: Test laufen lassen — muss fehlschlagen**

Run: `npx vitest run src/app/sw.test.ts`
Expected: FAIL — `sw.js` enthält noch keinen `push`-Handler.

- [ ] **Step 3: SW-Handler ergänzen + Cache-Version anheben**

In `web/public/sw.js`: `const CACHE = "cockpit-v1";` → `const CACHE = "cockpit-v2";`. Den Kommentar-Satz „No push notifications." entfernen. Am Dateiende anhängen:

```js
self.addEventListener("push", (event) => {
  const data = event.data ? event.data.json() : {};
  event.waitUntil(
    self.registration.showNotification(data.title ?? "Cockpit", {
      body: data.body ?? "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { url: data.url ?? "/" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        const open = clients.find((c) => "focus" in c);
        if (open) return open.focus();
        return self.clients.openWindow(url);
      }),
  );
});
```

- [ ] **Step 4: Test laufen lassen — muss bestehen**

Run: `npx vitest run src/app/sw.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add web/public/sw.js web/src/app/sw.test.ts
git commit -m "feat(push): service worker push + notificationclick handlers"
```

---

### Task 5: Versand in `generatePlanAction` einhängen

**Files:**
- Modify: `web/src/app/actions/meals.ts:41-57` (`generatePlanAction`)

**Interfaces:**
- Consumes: `sendToAdults` + `PushPayload` (Task 2).

> Nur bei NEUEM Entwurf pushen — NICHT in `rerollDraftDayAction`/`setDraftDayRecipeAction`.

- [ ] **Step 1: Import ergänzen**

In `web/src/app/actions/meals.ts` bei den Service-Imports ergänzen:

```ts
import { sendToAdults } from "@/lib/services/pushNotify";
```

- [ ] **Step 2: Versand nach Entwurfserzeugung einfügen**

In `generatePlanAction`, zwischen `await generateWeekPlan(...)` und `revalidatePath("/")`, einfügen:

```ts
  // Roadmap C2: Beide Handys benachrichtigen, dass ein Entwurf bereitliegt.
  // Non-fatal — ein Push-Fehler darf die Entwurfserzeugung nicht scheitern lassen.
  await sendToAdults({
    title: "Essensplan-Entwurf bereit 🍽️",
    body: "Antippen zum Abnicken oder Ändern.",
    url: "/",
  });
```

- [ ] **Step 3: Typecheck + bestehende Meal-Tests**

Run: `npm run typecheck && npx vitest run src/lib/services/mealPlanner.test.ts`
Expected: PASS (kein Regress; `sendToAdults` ist ohne VAPID-Config ein No-op).

- [ ] **Step 4: Commit**

```bash
git add web/src/app/actions/meals.ts
git commit -m "feat(push): notify both phones when a meal-plan draft is generated"
```

---

### Task 6: Client `PushSetupControl` + Einbindung

**Files:**
- Create: `web/src/components/PushSetupControl.tsx`
- Modify: `web/src/components/dashboard.tsx` (Komponente nahe der Essensplan-Kachel einhängen)

**Interfaces:**
- Consumes: `subscribePushAction`, `unsubscribePushAction` (Task 3); `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.

- [ ] **Step 1: Next-Guide lesen**

Client-Components/Conventions-Guide unter `web/node_modules/next/dist/docs/` prüfen (Breaking Changes).

- [ ] **Step 2: Komponente implementieren**

`web/src/components/PushSetupControl.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";

import { subscribePushAction, unsubscribePushAction } from "@/app/actions/push";

type Status = "loading" | "unconfigured" | "unsupported" | "idle" | "subscribed" | "denied";

const VAPID_PUBLIC_KEY = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

/** URL-safe base64 → Uint8Array for applicationServerKey. */
function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(normalized);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) out[i] = raw.charCodeAt(i);
  return out;
}

export function PushSetupControl() {
  const [status, setStatus] = useState<Status>("loading");

  useEffect(() => {
    if (!VAPID_PUBLIC_KEY) return setStatus("unconfigured");
    if (
      typeof window === "undefined" ||
      !("serviceWorker" in navigator) ||
      !("PushManager" in window) ||
      !window.isSecureContext
    ) {
      return setStatus("unsupported");
    }
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setStatus(sub ? "subscribed" : "idle"))
      .catch(() => setStatus("idle"));
  }, []);

  async function enable(personKey: "dome" | "emely") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return setStatus("denied");
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY!),
    });
    const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
    await subscribePushAction(personKey, json);
    setStatus("subscribed");
  }

  async function disable() {
    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.getSubscription();
    if (sub) {
      await unsubscribePushAction(sub.endpoint);
      await sub.unsubscribe();
    }
    setStatus("idle");
  }

  if (status === "loading") return null;
  if (status === "unconfigured")
    return <p className="text-xs text-slate-500">🔔 Push nicht eingerichtet</p>;
  if (status === "unsupported")
    return <p className="text-xs text-slate-500">🔔 Push auf diesem Gerät nicht verfügbar</p>;
  if (status === "denied")
    return <p className="text-xs text-amber-500">🔔 Push abgelehnt — in den Browser-Einstellungen erlauben</p>;
  if (status === "subscribed")
    return (
      <div className="flex items-center gap-2 text-xs">
        <span className="text-emerald-500">🔔 aktiv auf diesem Gerät</span>
        <button onClick={disable} className="underline text-slate-400">deaktivieren</button>
      </div>
    );
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="text-slate-400">🔔 Auf diesem Handy aktivieren:</span>
      <button onClick={() => enable("dome")} className="underline">Dome</button>
      <button onClick={() => enable("emely")} className="underline">Emely</button>
    </div>
  );
}
```

- [ ] **Step 3: In Dashboard einhängen**

In `web/src/components/dashboard.tsx` `PushSetupControl` importieren und nahe der Essensplan-Kachel/`MealDraftPanel` rendern (analog zu vorhandenen Controls wie `FreshShoppingControl`). Den exakten Einhängepunkt am bestehenden Layout orientieren.

```tsx
import { PushSetupControl } from "@/components/PushSetupControl";
// ... im JSX, nahe der Essensplan-Kachel:
<PushSetupControl />
```

- [ ] **Step 4: Lint + Typecheck + Build**

Run: `npm run lint && npm run typecheck && npm run build`
Expected: PASS (keine Fehler/Warnings, Build grün).

- [ ] **Step 5: Commit**

```bash
git add web/src/components/PushSetupControl.tsx web/src/components/dashboard.tsx
git commit -m "feat(push): PushSetupControl — per-device enable with person picker"
```

---

### Task 7: VAPID-Keys & Betrieb dokumentieren

**Files:**
- Create: `web/docs/push-setup.md` (oder unter `docs/setup/` — am bestehenden Doc-Layout orientieren)
- Modify: `web/.env` (lokal/worktree — NICHT committen), ggf. `.env.example` falls vorhanden

- [ ] **Step 1: VAPID-Keys generieren**

Run: `npx web-push generate-vapid-keys`
Expected: Public/Private Key ausgegeben.

- [ ] **Step 2: Env setzen (worktree `.env`, nicht committen)**

In `web/.env`:

```
VAPID_PUBLIC_KEY=<publicKey>
VAPID_PRIVATE_KEY=<privateKey>
VAPID_SUBJECT=mailto:dominique.lehmann1997@gmail.com
NEXT_PUBLIC_VAPID_PUBLIC_KEY=<publicKey>
```

- [ ] **Step 3: Setup-Doc schreiben**

`web/docs/push-setup.md` mit: Key-Generierung, die vier Env-Variablen, Hinweis dass Real-Versand den Cloudflare-Tunnel (public HTTPS) braucht, und dass Localhost zwar das Abonnieren erlaubt aber der Versand über den Tunnel-Host läuft. iOS-Hinweis (nur als installierte PWA ab 16.4; Android unkritisch).

- [ ] **Step 4: Commit**

```bash
git add web/docs/push-setup.md
git commit -m "docs(push): VAPID key generation and operations notes"
```

---

## Manuelle End-to-End-Verifikation (nach allen Tasks)

Nicht automatisierbar (echte Push-Zustellung). Auf dem Tablet/Handy über den Cloudflare-Tunnel:

1. App öffnen → 🔔 → „Dome" wählen → Browser-Erlaubnis erteilen → „aktiv auf diesem Gerät".
2. Auf einem zweiten Gerät dasselbe mit „Emely".
3. „Woche neu planen" auslösen (`generatePlanAction`) → beide Geräte erhalten Push „Essensplan-Entwurf bereit 🍽️".
4. Push antippen → App öffnet/fokussiert, MealDraftPanel sichtbar.
5. „deaktivieren" → kein weiterer Push auf dem Gerät.

---

## Self-Review (vom Plan-Autor durchgeführt)

- **Spec-Abdeckung:** Datenmodell (T1) · Service+web-push (T2) · Actions (T3) · SW-Handler (T4) · Trigger in generatePlanAction (T5) · Client-Knopf+Person-Picker (T6) · VAPID/Env/Docs (T7). Fehlerbehandlung (non-fatal, 410/404, fehlende Config, Permission denied) in T2/T6 abgedeckt. Tests in T1/T2/T4. Alle Spec-Abschnitte zugeordnet.
- **Platzhalter:** keine — jeder Code-Schritt enthält vollständigen Code; T6-Dashboard-Einhängepunkt verweist bewusst aufs bestehende Layout (existierender Code, nicht erfindbar).
- **Typkonsistenz:** `upsertSubscription`/`deleteSubscription`/`getAllSubscriptions`, `PushSubscriptionInput`/`StoredSubscription`, `PushPayload`, `sendToAdults`, `subscribePushAction`/`unsubscribePushAction`, `WebPushSubscriptionJSON` — über Tasks hinweg einheitlich benannt. Payload-Form `{title,body,url}` identisch in T2/T4/T5.
