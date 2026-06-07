# Spike: Bring!-Integration – Machbarkeit eines inoffiziellen API-Push (2026-06-07)

## Ergebnis / Empfehlung

**Push ist realistisch – mit Fallback-Pflicht und defensivem Error-Handling.**
Die inoffizielle Bring!-REST-API ist seit Jahren stabil unter `https://api.getbring.com/rest/v2/...` erreichbar, wird von der **offiziellen Home-Assistant-Bring!-Integration** genutzt (Hunderttausende Installationen) und von mehreren aktiv gepflegten Bibliotheken sauber gewrappt. Der Login-/Item-Flow (`POST /v2/bringauth` → `PUT /v2/bringlists/{uuid}/items`) ist simpel und seit Jahren unverändert. Gleichzeitig zeigen aktuelle Issues (April/Mai 2026), dass Bring laufend neue, von den Clients nicht vorhergesehene Response-Felder einführt (z. B. `RETAIL_PRODUCT`-Attribute) und Auth-Fehlermeldungen in wechselnden Formaten zurückgibt – das bricht *Lese*-Pfade öfter als den simplen *Schreib*-Pfad ("Item hinzufügen"), den das Dashboard primär braucht. Empfehlung: Push implementieren, aber mit (a) try/catch + klarer Nutzer-Fehlermeldung, (b) Versionspinning der Lib und (c) einem dokumentierten manuellen Fallback (Liste teilen / Items per Hand eintragen), falls die API mal bricht.

---

## Inoffizielle API: Endpoints & Auth-Flow

Quelle der Endpoint-Details: README/Issue von `foxriver76/node-bring-api` (Stand 2026-06-07, Issue #305 zitiert die Roh-Response) und `miaucl/bring-api`-Referenzdokumentation.

- **Basis-URL:** `https://api.getbring.com/rest/`
- **1. Login** – `POST https://api.getbring.com/rest/v2/bringauth`
  - Body (`application/x-www-form-urlencoded`): `email`, `password`
  - Response (JSON, bei Erfolg): enthält `access_token` (Bearer), `uuid` (User-UUID), `publicUuid`, `name` etc.
  - Bei Fehler: **kein verlässliches JSON** – Bring liefert teils `Content-Type: text/plain` mit Klartext wie `Invalid Email.` und HTTP 401 (siehe Issue unten). Clients, die naiv `resp.json()` aufrufen, werfen dann nur `Failed to parse JSON`.
- **2. Listen abrufen** – `GET /bringusers/{userUuid}/lists`
  - Response: Array von Listen-Objekten mit `listUuid`, `name`, `theme` – die `listUuid` ist die ID, die für alle weiteren Operationen gebraucht wird (entspricht `BRING_LIST_UUID`).
  - Auth-Header: `Authorization: Bearer <access_token>`, zusätzlich `X-BRING-USER-UUID` / `X-BRING-PUBLIC-USER-UUID`.
- **3. Item hinzufügen** – `PUT /v2/bringlists/{listUuid}/items`
  - Body: Batch-Update mit `itemId`/`name`, `spec`/`specification`, `operation: "ADD" | "COMPLETE" | "REMOVE"` – ein oder mehrere Items pro Request möglich.
  - Alternativ (ältere/einfachere Variante in node-bring-api): `saveItem(listUuid, itemName, specification)` macht intern denselben Call.

Diese Endpoint-Struktur ist seit Jahren konsistent (die Reverse-Engineering-Repos verweisen alle auf dieselben Pfade); v2 hat die Legacy-API (v1, ohne `/v2/`-Präfix) abgelöst – `miaucl/bring-api` weist explizit darauf hin, dass es seit 2024-02 nur noch die "non-legacy" Version nutzt.

**Quelle für die Roh-URL/Statuscodes:** [`foxriver76/node-bring-api` Issue #305](https://github.com/foxriver76/node-bring-api/issues/305) (zitiert direkt `POST https://api.getbring.com/rest/v2/bringauth → 401, Content-Type: text/plain, Body: "Invalid Email."`), abgerufen 2026-06-07.

---

## Client-Bibliotheken

| Name | Sprache | Wartungsstand | Eignung |
|---|---|---|---|
| **`bring-shopping`** (Repo `foxriver76/node-bring-api`, npm `bring-shopping`) | Node.js / TypeScript, **zero-dependency**, nutzt natives `fetch` (Node ≥ 18) | v2.0.1, veröffentlicht 2025-01-21 (~1,5 Jahre alt); 73★; aktive offene Issues bis Mai 2026 (#305/#306, von Maintainer kommentiert/in Bearbeitung) – Repo lebt also noch, aber Release-Tempo ist niedrig | **Beste Wahl für das Dashboard** (Next.js/Node-Stack passt direkt, keine Dependency-Last). API: `login()`, `loadLists()`, `getItems()`, `saveItem(listUuid, itemName, spec)` |
| **`miaucl/bring-api`** | Python, async (`aiohttp`) | Sehr aktiv: 307 Commits, 45 Releases, letztes Release 2026-05-04 (v1.1.2), 61★, 6 Forks; **Basis der offiziellen Home-Assistant-Bring!-Integration** | Funktional die "Referenzimplementierung" (sauberste Doku), aber falsche Sprache für ein Next.js-Dashboard – höchstens als Doku-Quelle relevant |
| **`eliasball/python-bring-api`** | Python | **Archiviert/unmaintained seit 2026-04-08**, letztes Release 2024-02-21; README verweist explizit auf `miaucl/bring-api` als Nachfolger | Nicht verwenden |
| `tekikaito/node-bring-api`, `Squawnchy/node-bring-api` | Node.js (Forks von foxriver76) | Forks ohne erkennbare Eigenentwicklung | Nicht relevant |
| `bring-mcp` (florianwittkamp) | MCP-Server für Bring! | Existiert als MCP-Wrapper – interessant, falls das Dashboard später MCP-Agenten nutzt, aber für direkten REST-Push unnötiger Umweg | Nur als Fußnote |

→ **Empfehlung: `bring-shopping` (npm)** – passt zum Node/Next.js-Stack des Dashboards, zero-dependency, deckt exakt `login()` → `loadLists()` → `saveItem()` ab.

---

## Risiken

1. **Response-Schema-Drift (real, aktuell beobachtet):** HA-Core-Issue [#167545](https://github.com/home-assistant/core/issues/167545) (gemeldet 2026-04, Status: offen) zeigt, dass Bring im April 2026 ein neues Item-Attribut `RETAIL_PRODUCT` (Angebote/Prospekt-Integration, z. B. „Kaufland“) in die Item-Response eingebaut hat, das die HA-Pydantic-Validierung zum Absturz brachte (`Setup error: will retry`). Das betrifft primär das **Lesen** von Listen (Item-Details inkl. Angebotsmetadaten); reines Item-**Hinzufügen** ist von solchen neuen Lesefeldern unberührt, aber es zeigt: Bring ändert die API-Oberfläche ohne Versionierung/Deprecation-Hinweis, und Clients mit strikter Schema-Validierung brechen dabei.
2. **Inkonsistente Fehlerformate beim Login:** [node-bring-api Issue #305](https://github.com/foxriver76/node-bring-api/issues/305) (Mai 2026, offen, mit Fix-PR #306 in Arbeit) zeigt, dass Bring bei Login-Fehlern teils `text/plain` statt JSON liefert (`401 Invalid Email.`), wodurch naive JSON-Parser nur „Failed to parse JSON“ werfen. Der Issue-Autor merkt zudem an, dass dasselbe Verhalten potenziell bei **Rate-Limiting, Wartungsseiten und Cloudflare-Challenges** auftritt – also Vorsicht vor zu häufigen Login-Versuchen.
3. **Kein offizielles SLA / ToS-Risiko:** Bring! Labs AG stellt explizit klar, dass keine offizielle API existiert; alle Libraries tragen Disclaimer ("in no way endorsed by or affiliated with Bring! Labs AG"). Es gibt keine dokumentierten Fälle von Account-Sperrungen wegen API-Nutzung in der Community, aber das Risiko ("ToS-Verstoß", Account-Sperre bei "automatisiertem Zugriff") lässt sich nicht ausschließen – die Home-Assistant-Integration läuft jedoch seit Jahren produktiv ohne bekannte Sperrwellen, was das Risiko praktisch gering erscheinen lässt.
4. **Wartungslage der Node-Lib ist "ok, aber langsam":** `bring-shopping` hatte zuletzt im Januar 2025 ein Release; aktuelle Bug-Reports (Mai 2026) sind offen, aber der Maintainer reagiert noch (Kommentare/Linked-PR vorhanden). Kein Hinweis auf Aufgabe des Projekts.
5. **2FA/Captcha:** Keine Berichte über 2FA- oder Captcha-Pflicht beim Bring!-Login in 2025/2026 gefunden – der reine Email/Passwort-Flow scheint weiterhin Standard zu sein (anders als z. B. bei Tado, wo HA-Issue #163383 im Feb. 2026 Auth-Brüche zeigt). Das ist positiv für die Machbarkeit, aber nicht 100 % zukunftssicher.

---

## Fallback-Optionen

Falls der direkte Push zu fragil wird oder bricht:

1. **Liste teilen / "Open in Bring"-Deeplink:** Bring unterstützt App-Deeplinks (`bring://...` bzw. Web-Share-Links), über die man Listen/Rezepte importieren kann. Das Dashboard könnte einen Button "In Bring öffnen" anzeigen, der die Items als teilbare Liste/URL aufbereitet – der Nutzer bestätigt den Import manuell in der App. Kein API-Login nötig, dafür ein manueller Klick pro Einkauf.
2. **Copy-to-Clipboard / manuelles Eintragen:** Einfachste, robusteste Variante – das Dashboard zeigt die Einkaufsliste (aus Rezept oder manuell) als Textblock, der Nutzer fügt sie in Bring per Sprach-/Texteingabe ein. Null Wartungsaufwand, aber kein "echter" Push.
3. **E-Mail-zu-Bring:** Es gibt keine offiziell dokumentierte E-Mail-Import-Funktion für Bring! (im Gegensatz zu manchen anderen Listen-Apps) – diese Option wurde recherchiert, aber nicht bestätigt; nicht empfohlen als Plan.
4. **MCP-Server `bring-mcp`:** Falls das Dashboard ohnehin auf einen Agenten-/MCP-Layer setzt, existiert ein dedizierter Bring!-MCP-Server, der den Push kapselt – reduziert eigenen Wartungsaufwand, fügt aber eine zusätzliche Abhängigkeit hinzu.

---

## Integrations-Skizze (Empfehlung: Push umsetzen)

- **npm-Lib:** `bring-shopping` (zero-dependency, TypeScript, Node ≥ 18 – passt zur Next.js-App in `web/`)
- **`.env`-Variablen** (bereits in `web/.env.example` vorgesehen):
  - `BRING_EMAIL`
  - `BRING_PASSWORD`
  - `BRING_LIST_UUID` (kann beim ersten Setup per `loadLists()` ermittelt und fest hinterlegt werden, statt bei jedem Request neu abzufragen)
- **Grober Ablauf** (serverseitig, z. B. in einer Next.js API-Route / Server Action):
  ```ts
  import Bring from 'bring-shopping';

  const bring = new Bring({ mail: process.env.BRING_EMAIL!, password: process.env.BRING_PASSWORD! });

  export async function pushToBring(items: { name: string; spec?: string }[]) {
    try {
      await bring.login();                 // POST /v2/bringauth -> Bearer-Token im Client gecacht
      for (const item of items) {
        await bring.saveItem(
          process.env.BRING_LIST_UUID!,
          item.name,
          item.spec ?? ''
        );                                  // PUT /v2/bringlists/{uuid}/items (operation=ADD)
      }
      return { ok: true };
    } catch (e) {
      // defensiv: Bring liefert bei Fehlern teils text/plain statt JSON (siehe Issue #305)
      return { ok: false, error: String(e) };
    }
  }
  ```
- **Anbindung an den Dashboard-Einkauf:**
  - Beim Erzeugen einer Einkaufsliste mit `source="recipe"` (aus einem Rezept generiert) oder `source="manual"` (frei eingetragen) sammelt das Dashboard die Items in einer einheitlichen Struktur `{ name, spec?, source }`.
  - Ein Button "An Bring senden" (oder automatischer Trigger nach Bestätigung) ruft `pushToBring(items)` serverseitig auf.
  - Bei Erfolg: Toast/Status "An Bring übertragen"; bei Fehler: Fallback-Hinweis anzeigen ("Bring-Push fehlgeschlagen – Liste manuell kopieren?") inkl. der Klartext-Liste zum Copy-Paste (= Fallback-Option 2 als eingebauter Sicherheitsnetz-Pfad, nicht nur als Notlösung).
  - `login()`-Ergebnis (Bearer-Token) sollte pro Server-Prozess kurz gecacht werden, um wiederholte Logins (und damit Rate-Limit-Risiko, siehe Issue #305) zu vermeiden.

---

## Quellen

- [`foxriver76/node-bring-api` (GitHub-Repo, README, Issues)](https://github.com/foxriver76/node-bring-api) – abgerufen 2026-06-07
- [`foxriver76/node-bring-api` Issue #305 – "login() swallows text/plain auth error messages"](https://github.com/foxriver76/node-bring-api/issues/305) – abgerufen 2026-06-07 (zitiert rohe API-URL/Statuscodes)
- [`foxriver76/node-bring-api` Issue #306 – Fix-PR zu #305](https://github.com/foxriver76/node-bring-api/issues/306) – abgerufen 2026-06-07
- [`bring-shopping` auf npm](https://www.npmjs.com/package/bring-shopping) – abgerufen 2026-06-07
- [`miaucl/bring-api` (GitHub-Repo, Python, Basis der HA-Integration)](https://github.com/miaucl/bring-api) – abgerufen 2026-06-07
- [`miaucl/bring-api` API-Referenzdokumentation](https://miaucl.github.io/bring-api/reference/) – abgerufen 2026-06-07 (Endpoint-Pfade `v2/bringauth`, `bringusers/{uuid}/lists`, `v2/bringlists/{uuid}/items`)
- [`eliasball/python-bring-api` (archiviert seit 2026-04-08)](https://github.com/eliasball/python-bring-api) – abgerufen 2026-06-07
- [Home Assistant Core Issue #167545 – "Bring! integration: Setup failed due to ValidationError (RETAIL_PRODUCT)"](https://github.com/home-assistant/core/issues/167545) – gemeldet April 2026, abgerufen 2026-06-07
- [Home Assistant Core Issue #154436 – "Bring! integration login fail"](https://github.com/home-assistant/core/issues/154436) – November 2025, abgerufen 2026-06-07
- [`mcpservers.org` – Bring! MCP-Server (florianwittkamp/bring-mcp)](https://mcpservers.org/servers/florianwittkamp/bring-mcp) – abgerufen 2026-06-07
- `web/.env.example` (lokal, Dashboard-Repo) – Referenz für bereits vorgesehene `BRING_*`-Variablen
