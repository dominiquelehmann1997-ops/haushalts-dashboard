# Rezepte finden & per Link übernehmen

Antwort auf die Frage: *Wo finde ich kostenlos neue, kalorienarme, einfache
Rezepte — und wie kommen die möglichst mit einem Link ins Rezeptbuch?*

Kurzfassung: **Rezeptseite raussuchen → Link kopieren → im Dashboard unter
Essensplan bei „Rezept per Link" einfügen.** Das Rezept steht danach im
Rezeptbuch (*Essen → Rezepte*) und ist sofort im Essensplan wählbar.

---

## 1. Woher die Rezepte kommen


Alle folgenden Seiten sind kostenlos, ohne Login nutzbar und liefern
Kalorienangaben pro Portion. Sortiert nach Nutzen für „kalorienarm + einfach":

| Seite | Warum | Kalorienarm-Einstieg |
|---|---|---|
| **EAT SMARTER** | Jedes Rezept mit vollständigen Nährwerten, sehr viele leichte Alltagsgerichte. Beste Trefferquote für „wenig kcal, trotzdem satt". | `eatsmarter.de` → Rubrik *Kalorienarme Rezepte* |
| **REWE Rezepte** | Alltagstauglich, deutsche Supermarkt-Zutaten (passt zur Bring-Liste), kcal pro Portion. | [rewe.de/rezeptsammlung/kalorienarm](https://www.rewe.de/rezeptsammlung/kalorienarm/) |
| **Chefkoch** | Mit Abstand die größte Auswahl; Bewertungen zeigen zuverlässig, was wirklich schmeckt. Nährwerte nicht bei jedem Rezept. | `chefkoch.de` → Suche + Filter *kalorienarm* / *Low Carb* |
| **essen & trinken – Leichte Küche** | Redaktionell kuratiert, Gerichte mit max. ~400 kcal. | [essen-und-trinken.de/leichte-kueche](https://www.essen-und-trinken.de/leichte-kueche) |
| **eat.de** | Salate, Suppen, Ofengerichte — viel Einfaches mit wenig kcal. | [eat.de → kalorienarme Rezepte](https://eat.de/rezeptidee/rezepte-zum-abnehmen/kalorienarme-rezepte/) |
| **Upfit / kaloriengeniessen.de / FitnessFoodie** | Kleinere, aber konsequent auf kalorienarm getrimmte Sammlungen. | [upfit.de/rezepte/kalorienarme-rezepte](https://upfit.de/rezepte/kalorienarme-rezepte/) · [kaloriengeniessen.de](https://kaloriengeniessen.de/kalorienarme-rezepte-uebersicht/) · [fitnessfoodie.de](https://www.fitnessfoodie.de/rezepte/kalorienarm/) |

**Empfehlung für den Alltag:** EAT SMARTER und REWE als Stammquellen (verlässliche
Nährwerte, einfache Zutaten), Chefkoch dazu, wenn etwas Bestimmtes gesucht wird —
dort entscheiden die Bewertungen.

---

## 2. Der Weg ins Rezeptbuch

Der Importer liest die **schema.org-Rezeptdaten** der Seite. Das ist das
Markup, das jede Rezeptseite für die Google-Rezeptvorschau ausliefert — also
genau die Daten, die schon strukturiert vorliegen: Zutaten, Mengen, Schritte,
Portionen, kcal, Titelbild. **Kein LLM, keine API-Keys, keine Kosten**, ein
Request pro Rezept.

**Am Handy:** Dashboard → *Essensplan* → **Rezept per Link** → Link einfügen →
*übernehmen*. Danach steht das Rezept sofort im Essensplan zur Wahl.

**Am Handy per Teilen-Menü (ObsidiDine):** Für alles, was *kein* Rezept-Markup
hat — ein abfotografiertes Rezept aus einem Kochbuch oder von einer
HelloFresh-Karte, eine Instagram- oder TikTok-Caption, eine
YouTube-Beschreibung. Foto oder Link ins Teilen-Menü → *ObsidiDine* wählen. Die
App liest den Text (OCR läuft auf dem Gerät), schickt ihn ans Dashboard, und
dort extrahiert **Claude über das Abo** das Rezept — kein API-Key, keine Kosten
pro Import. Das Ergebnis kommt zurück in die App, wo du es vor dem Speichern
noch anpassen kannst.

Das ist der Weg für Quellen, an denen der Link-Import scheitert. Ein normaler
Rezept-Link geht auch über die App, wird aber intern trotzdem ohne LLM aus dem
Seiten-Markup gelesen — schneller und genauer.

**Am Rechner/Tablet-Terminal:**

```bash
npm run import:recipe -- "https://www.chefkoch.de/rezepte/…"
npm run import:recipe -- "https://…" "https://…"   # mehrere auf einmal
```

Was übernommen wird: Name, Zutaten mit Mengen und Einheiten, Zubereitung,
Portionen, Zeiten, Nährwerte pro Portion, Tags, die Quell-URL und das
Titelbild. Bewertung und Notizen bleiben leer — die gehören dem Haushalt.

Details, die den Alltag betreffen:

- **`kalorienarm` wird automatisch getaggt**, wenn die Seite ≤ 500 kcal pro
  Portion meldet — damit sind die leichten Rezepte in der Rezeptliste
  filterbar.
- **Erneuter Import derselben URL aktualisiert dasselbe Rezept** (erkannt über
  die Quell-URL, ersatzweise über den Slug) statt ein Duplikat anzulegen. Ein
  ausgemustertes Rezept wird dabei wiederbelebt.
- **Was du selbst gepflegt hast, überlebt den Re-Import:** Bewertung, Notizen
  und Bild bleiben stehen. Die Quelle weiß nichts davon, und ein erneuter
  Import darf einen Favoriten nicht auf „ok" zurücksetzen.
- **`rating` und `reheatable` kommen neutral** (`ok` / `false`) — das ist eine
  Haushaltsentscheidung, keine Information der Rezeptseite. Nach dem ersten
  Kochen in der App anpassen.
- **Mengen werden aufgeräumt:** `½ TL` → `amount: '0,5', unit: TL`,
  `2 Süßkartoffel(n)` → `Süßkartoffel`. Brüche werden zu deutschen
  Dezimalzahlen, damit die Bring-Aggregation sie zusammenrechnen kann;
  Bereiche wie `2-3` bleiben Text.
- **Das Titelbild wird einmalig geladen** und liegt danach unter
  `RECIPE_IMAGE_DIR`. Ein erneuter Import lässt ein vorhandenes Bild in Ruhe.
  Fehlschlag ist nie fatal — dann bleibt das Rezept eben bildlos.
- Erkennt die Seite kein Rezept-Markup, sagt der Importer das explizit. Dann
  bleibt: das Rezept in der App von Hand anlegen (*Essen → Rezepte → Neu*).

> **Obsidian-Werkzeuge (Web Clipper, „Recipe Grabber") gehören nicht mehr zum
> Weg.** Sie schreiben in einen Vault, und aus dem liest das Dashboard seit dem
> Vault-Ausbau nicht mehr. Zum Sammeln von Lesestoff taugen sie weiter — ins
> Rezeptbuch kommt ein Rezept nur über den Link-Import oder von Hand.

---

## 3. Grenzen & Umgangsformen

- **Kein Massen-Scraping.** Der Importer holt eine Seite pro Rezept, auf
  Knopfdruck, für den privaten Gebrauch. Bitte so lassen — keine Schleifen über
  ganze Kategorieseiten.
- **Instagram-Reels/TikToks kann er nicht** (kein Rezept-Markup).
- **Nährwerte gelten pro Portion** und stammen von der Quelle — ungeprüft. Sie
  werden beim Skalieren der Portionen bewusst nicht mitgerechnet: kcal bleibt
  kcal pro Portion.

## 4. Technisches

- Reine Logik + Tests: `web/src/lib/services/recipeImport.ts` (+ `.test.ts`)
- CLI: `web/prisma/importRecipe.ts` → `npm run import:recipe`
- Server-Action: `importRecipeUrlAction` in `web/src/app/actions/recipes.ts`
- UI: `web/src/components/RecipeUrlImport.tsx` (Mobile-Seite *Essensplan*)
- Geschrieben wird direkt in die DB über `upsertImportedRecipe`
  (`web/src/lib/repositories/recipes.ts`) — derselbe Weg, den auch die
  Claude-Rezeptideen nehmen. Es gibt keine Vault-Datei mehr.
- Bild-Download: `web/src/lib/services/recipeImage.ts`, Ablage in
  `RECIPE_IMAGE_DIR`.
- Backup der Rezepte: [`rezept-export-format.md`](rezept-export-format.md).

### Der Weg über ObsidiDine

- Extraktion aus Rohtext: `web/src/lib/services/recipeExtract.ts` (+ `.test.ts`).
  Enthält den Prompt, das Antwort-Parsing und **einen** Repair-Retry — mehr als
  zwei CLI-Aufrufe pro Import gibt es nicht.
- Aufruf der `claude` CLI: `web/src/lib/services/claudeCli.ts`. Modell
  `claude-sonnet-5`. Die CLI beendet sich bei abgelaufenem Token **mit
  Exit-Code 0** und meldet den Fehler nur als `is_error` im JSON — der Wrapper
  wirft deshalb darauf, sonst verschwindet der Fehler lautlos.
- Vegetarisch-Erkennung: `web/src/lib/services/vegetarianTag.ts`. Feste
  Wortliste, kein LLM — deterministisch und kostenlos. Setzt den Tag
  `vegetarisch`; im App-Preview kann er überstimmt werden.
- Endpunkte: `web/src/app/api/recipes/parse/route.ts` (Text → Entwurf, **kein**
  DB-Schreibzugriff) und `web/src/app/api/recipes/import/route.ts` (Entwurf →
  DB). Beide über `web/src/lib/api/importAuth.ts` mit
  `Authorization: Bearer <RECIPE_IMPORT_TOKEN>` geschützt.
- App: Repository `Rezept-Importer`, `dashboard/DashboardClient.kt`. Die App
  hat keine API-Keys mehr; in den Einstellungen stehen Dashboard-Adresse,
  Import-Token und optional das Cloudflare-Access-Service-Token.

**Zwei Env-Variablen** in `web/.env` (beide in `.env.example` beschrieben):

- `RECIPE_IMPORT_TOKEN` — ohne ihn antworten beide Endpunkte mit 503 statt
  ungeschützt zu laufen.
- `CLAUDE_CODE_OAUTH_TOKEN` — langlebiger Abo-Token, erzeugt mit
  `claude setup-token`. Läuft er ab, hängt jeder Import rund drei Minuten in
  Retries und endet dann mit einem 401.

**Grenzen:** Nährwerte werden nur übernommen, wenn die Quelle sie *pro Portion*
angibt. Steht dort „pro 100 g", werden sie verworfen statt umgerechnet — ohne
Portionsgewicht wäre jede Umrechnung geraten, und falsche Zahlen sind schlimmer
als gar keine.
