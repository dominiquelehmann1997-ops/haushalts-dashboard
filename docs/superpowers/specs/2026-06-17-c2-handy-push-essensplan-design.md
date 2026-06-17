# C2 · Benachrichtigung aufs Handy — Web-Push für den Essensplan-Entwurf

> **Status:** Design freigegeben (2026-06-17). Roadmap-Schritt **C2** aus
> [`docs/superpowers/plans/2026-06-08-dashboard-roadmap-handy-steuerung-essensplan.md`](../plans/2026-06-08-dashboard-roadmap-handy-steuerung-essensplan.md).
> Nächster Schritt: `writing-plans` → TDD-Mikroplan.

## Ziel

Wenn ein **Essensplan-Entwurf** entsteht, bekommen **Dome und Emely** eine
Push-Benachrichtigung auf ihr Handy. Antippen öffnet die installierte App beim
Entwurf, wo "Abnicken" / "Ändern" schon existiert (C1). Damit wird die Leitidee
"Handy steuert, Tablet zeigt" für den Essensplan-Flow eingelöst — der Mental Load
sinkt, weil das Dashboard proaktiv meldet statt Pflege einzufordern.

Der frühere C2-Blocker ("nur localhost, kein public HTTPS") ist weg: der
Cloudflare-Tunnel liefert public HTTPS, also ist **Web-Push (PWA)** jetzt machbar
und der gewählte Kanal — kein Telegram-Bot / Todoist / E-Mail nötig.

## Nicht-Ziele (YAGNI)

- **Keine** Action-Buttons in der Notification ("Abnicken" direkt aus dem Push).
  Bräuchte einen ungeschützten, vom Service-Worker aufrufbaren Server-Endpoint —
  mehr Angriffsfläche. Tap → App → ein Tipp zum Abnicken reicht.
- **Keine** gezielten Per-Person-Pushes für dieses Event. `personKey` wird
  gespeichert (Fundament für später), dieses Event geht an **alle** Subscriptions.
- **Keine** anderen Push-Anlässe (nur der Essensplan-Entwurf). Andere Events
  später, wenn gebraucht.
- **Kein** Login-/Auth-System. Registrierung ist gerätebasiert per Selbstauswahl.

## Architektur

Folgt dem bestehenden Schichten-Pattern (Server Action → Service → Repository/DB).

### Datenmodell — `PushSubscription` (Prisma)

Neues Modell in `web/prisma/schema.prisma`:

| Feld         | Typ      | Anmerkung                                        |
|--------------|----------|--------------------------------------------------|
| `id`         | String   | `@id @default(cuid())`                           |
| `personKey`  | String   | "dome" \| "emely" (für spätere gezielte Pushes)  |
| `endpoint`   | String   | `@unique` — identifiziert das Gerät/Abo          |
| `p256dh`     | String   | Public-Key des Browsers (Verschlüsselung)        |
| `auth`       | String   | Auth-Secret des Browsers                         |
| `createdAt`  | DateTime | `@default(now())`                                |

Migration per Prisma. `personKey` ist bewusst ein String (kein FK auf `Person`),
konsistent mit dem vorhandenen `Person.key`-Muster ("dome"/"emely"/"baby").

### Service — `lib/services/pushNotify.ts`

- `sendToAdults(payload: PushPayload): Promise<void>`
  - Lädt alle `PushSubscription`-Einträge.
  - Sendet jedes Abo via `web-push` (npm) mit VAPID-Auth.
  - **Non-fatal:** fängt alle Fehler ab, wirft nie. Bei HTTP **410/404**
    (Abo abgelaufen/weg) → Subscription aus DB löschen (selbstheilend).
  - `PushPayload` = `{ title: string; body: string; url: string }` (JSON-Body).
- `isPushConfigured(): boolean` — true, wenn VAPID-Keys vorhanden sind.

VAPID-Konfiguration aus `process.env`:
`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (mailto-URL).
Generierung einmalig: `npx web-push generate-vapid-keys`.

### Server Actions — `app/actions/push.ts` (`"use server"`)

- `subscribePushAction(personKey: string, sub: WebPushSubscriptionJSON): Promise<void>`
  — **Upsert by `endpoint`** (Re-Abo desselben Geräts erzeugt kein Duplikat,
  aktualisiert ggf. `personKey`).
- `unsubscribePushAction(endpoint: string): Promise<void>` — löscht das Abo.

### Client — `components/PushSetupControl.tsx` (`"use client"`)

- Zeigt 🔔-Knopf. Zustände:
  - **nicht konfiguriert** (`NEXT_PUBLIC_VAPID_PUBLIC_KEY` fehlt) → Hinweis
    "Push nicht eingerichtet", inaktiv. Kein Crash.
  - **nicht abonniert** → Knopf "🔔 Auf diesem Handy aktivieren". Klick: Person
    wählen (Dome/Emely) → `Notification.requestPermission()` →
    `navigator.serviceWorker.ready` → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey })`
    → `subscribePushAction`.
  - **abonniert** → "✓ aktiv auf diesem Gerät" + "deaktivieren"
    (`pushManager.getSubscription().unsubscribe()` + `unsubscribePushAction`).
  - **Erlaubnis verweigert** → freundlicher Hinweis, kein Fehler.
- Eingehängt im Dashboard nahe der Essensplan-Kachel.

### Service Worker — `public/sw.js` (Erweiterung)

Bestehendes Verhalten (Install/Activate/Offline-Fetch) bleibt. Neu:

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
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((cs) => {
      const open = cs.find((c) => "focus" in c);
      if (open) return open.focus();
      return self.clients.openWindow(url);
    }),
  );
});
```

`CACHE`-Version auf `cockpit-v2` anheben, damit der neue SW sicher aktiviert wird.

## Datenfluss

**Anmeldung (einmalig pro Handy):**
1. Dome/Emely öffnet App → 🔔 → wählt "Dome" bzw. "Emely".
2. Browser-Erlaubnis → `pushManager.subscribe(applicationServerKey)`.
3. `subscribePushAction` speichert/aktualisiert die Subscription. Knopf →
   "✓ aktiv auf diesem Gerät".

**Push senden:**
1. `generatePlanAction` (`app/actions/meals.ts`) erzeugt den Entwurf
   (`generateWeekPlan`) → **danach** `sendToAdults({ title, body, url: "/" })`.
2. Nur bei **neuem Entwurf** (`generatePlanAction`) — **nicht** bei
   `rerollDraftDayAction` / `setDraftDayRecipeAction`. C3 ruft später eh
   `generatePlanAction`.
3. Beide angemeldeten Handys erhalten den Push.

**Notification:**
- Titel: „Essensplan-Entwurf bereit 🍽️"
- Text: „Antippen zum Abnicken oder Ändern."
- Tap → offenen App-Tab fokussieren, sonst `/` öffnen → MealDraftPanel sichtbar.

## Fehlerbehandlung

- **Push-Versand non-fatal:** `sendToAdults` wirft nie; ein Versand-Fehler oder
  null angemeldete Geräte darf die Entwurfserzeugung nicht scheitern lassen
  (gleiche Haltung wie der Bring-Push beim Abnicken).
- **Tote Abos:** HTTP 410/404 → Subscription löschen.
- **Fehlende VAPID-Config:** Client-Knopf inaktiv mit Hinweis; Server
  `sendToAdults` no-op (`isPushConfigured()` false).
- **Erlaubnis verweigert / SW nicht verfügbar (unsicherer Kontext):** Knopf zeigt
  Hinweis, kein Crash (analog `ServiceWorkerRegister`-Guard).

## Tests (Vitest)

- `lib/services/pushNotify.test.ts` — `web-push` gemockt:
  - baut korrektes JSON-Payload + sendet an alle geladenen Abos;
  - löscht Abo bei 410-Antwort;
  - `sendToAdults` wirft nicht, wenn ein Send rejected;
  - no-op ohne VAPID-Config.
- `app/actions/push.action.test.ts` — `subscribePushAction` upsertet by
  `endpoint` (zweimal dasselbe Gerät → ein Eintrag, `personKey` aktualisiert).
- `app/sw.test.ts` (erweitern) — `push`-Event ruft `showNotification` mit
  Titel/Body/`data.url`; `notificationclick` fokussiert offenes Fenster bzw.
  öffnet `url`.

## Betrieb / Konfiguration

- Real-Versand braucht public HTTPS = **Cloudflare-Tunnel** (vorhanden). Auf
  `localhost` (secure context) klappt das Abonnieren; echter Versand läuft über
  den Tunnel-Host.
- VAPID-Keys in `web/.env` (nicht committen) + `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
  für den Client. Setup-Schritt in `docs/` (Key-Generierung + env).
- **iOS-Hinweis:** Web-Push dort nur als installierte PWA ab iOS 16.4 — Dome &
  Emely nutzen Android, kein Thema.

## Abgrenzung zur Roadmap

- **C2** ist hiermit abgedeckt (Benachrichtigung + Kanalentscheidung Web-Push).
- **C3** (Auto-Auslöser "wenn beide zuhause") baut darauf auf: er ruft denselben
  `generatePlanAction`, der dann automatisch pusht. Separates Spec/Plan später.

## Hinweis für die Umsetzung

`web/AGENTS.md`: vor Code die relevanten Next-Guides unter
`node_modules/next/dist/docs/` lesen — diese Next-Version hat Breaking Changes
ggü. dem Trainingsstand (Server Actions, Conventions).
