# Rezepte finden & per Link in den Vault holen

Antwort auf die Frage: *Wo finde ich kostenlos neue, kalorienarme, einfache
Rezepte — und wie kommen die möglichst mit einem Link nach Obsidian?*

Kurzfassung: **Rezeptseite raussuchen → Link kopieren → im Dashboard unter
Essensplan bei „Rezept per Link" einfügen.** Das Rezept liegt danach als Notiz
im Obsidian-Vault und ist sofort im Essensplan wählbar.

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

## 2. Der Weg nach Obsidian — drei Optionen

### Option A (eingebaut): Link ins Dashboard einfügen

Der Importer liest die **schema.org-Rezeptdaten** der Seite. Das ist das
Markup, das jede Rezeptseite für die Google-Rezeptvorschau ausliefert — also
genau die Daten, die schon strukturiert vorliegen: Zutaten, Mengen, Schritte,
Portionen, kcal. **Kein LLM, keine API-Keys, keine Kosten**, ein Request pro
Rezept.

**Am Handy:** Dashboard → *Essensplan* → **Rezept per Link** → Link einfügen →
*übernehmen*. Danach steht das Rezept sofort im Essensplan zur Wahl.

**Am Rechner/Tablet-Terminal:**

```bash
npm run import:recipe -- "https://www.chefkoch.de/rezepte/…"
npm run import:recipe -- "https://…" "https://…"   # mehrere auf einmal
```

Was in der Notiz landet:

```yaml
---
id: gemuese-curry-mit-kokosmilch   # Identitäts-Anker, ändert sich nie
name: Gemüse-Curry mit Kokosmilch
rating: ok                          # Bewertung vergibst du selbst
simple: true                        # aus Zeit + Zutatenzahl abgeleitet
reheatable: false                   # weiß die Seite nicht — bei Bedarf setzen
source: https://…                   # Anker für den erneuten Import
tags: [kalorienarm, vegetarisch, curry]
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 420
  protein: 18
ingredients:
  - name: Kokosmilch
    amount: '400'
    unit: ml
---

## Zubereitung
1. …

## Quelle
https://…
```

Details, die den Alltag betreffen:

- **`kalorienarm` wird automatisch getaggt**, wenn die Seite ≤ 500 kcal pro
  Portion meldet — damit sind die leichten Rezepte im Vault filterbar.
- **Erneuter Import derselben URL aktualisiert dieselbe Notiz** (erkannt über
  `source`, ersatzweise über `id`) und behält die `id` bei. Es entsteht also
  kein Duplikat und nichts wird fälschlich archiviert.
- **`rating` und `reheatable` bleiben neutral** (`ok` / `false`) — das ist eine
  Haushaltsentscheidung, keine Information der Rezeptseite. Nach dem ersten
  Kochen in Obsidian anpassen; ein späterer Re-Import überschreibt das
  allerdings wieder.
- **Mengen werden aufgeräumt:** `½ TL` → `amount: '0,5', unit: TL`,
  `2 Süßkartoffel(n)` → `Süßkartoffel`. Brüche werden zu deutschen
  Dezimalzahlen, damit die Bring-Aggregation sie zusammenrechnen kann;
  Bereiche wie `2-3` bleiben Text.
- Erkennt die Seite kein Rezept-Markup, sagt der Importer das explizit — dann
  Option B.

### Option B (universell): Obsidian Web Clipper

Der [offizielle Web Clipper](https://obsidian.md/clipper) ist kostenlos, gibt es
als Browser-Erweiterung und für iOS/Android (Teilen-Menü). Er schneidet
*beliebige* Seiten mit — auch Foodblogs ohne Rezept-Markup, hinter denen Option A
passen muss.

Sinnvolle Arbeitsteilung: **Web Clipper zum Sammeln, Importer zum Veredeln.**
Wenn eine geclippte Seite doch Rezept-Markup hat, einfach zusätzlich denselben
Link durch Option A schicken — dann liegt sie dashboard-tauglich im Vault.

Template-Bausteine, die der Clipper aus schema.org zieht (Vorlagen-Einstellungen
→ Eigenschaften/Note content):

```
{{schema:@Recipe:name}}
{{schema:@Recipe:recipeYield}}
{{schema:recipeIngredient|list}}
{{schema:recipeInstructions|list:numbered}}
{{schema:@Recipe:nutrition}}
{{url}}
```

Wichtig: Der Clipper schreibt Zutaten als **Textzeilen**, nicht als
`ingredients`-Objekte mit `name`/`amount`/`unit`. Für die Einkaufsliste und den
Bring-Push braucht das Dashboard aber die Objektform — deshalb ist Option A der
Weg für alles, was wirklich in den Essensplan soll. (Filter-Namen im Clipper
können sich zwischen Versionen unterscheiden; im Vorlagen-Editor gegenprüfen.)

### Option C: Community-Plugin „Recipe Grabber"

[Recipe Grabber](https://github.com/seethroughdev/obsidian-recipe-grabber) holt
ein Rezept direkt in Obsidian aus einer eingefügten URL (ebenfalls über JSON-LD,
Layout per Handlebars anpassbar). Praktisch, wenn man **innerhalb von Obsidian**
bleiben will. Es schreibt aber ein eigenes Format, nicht unseren Vault-Contract —
für Rezepte, die ins Dashboard sollen, bleibt Option A die richtige Wahl.

---

## 3. Grenzen & Umgangsformen

- **Kein Massen-Scraping.** Der Importer holt eine Seite pro Rezept, auf
  Knopfdruck, für den privaten Gebrauch. Bitte so lassen — keine Schleifen über
  ganze Kategorieseiten.
- **Instagram-Reels/TikToks kann er nicht** (kein Rezept-Markup). Dafür ist der
  separate Importer aus `docs/recipe-importer-init-prompt.md` gedacht.
- **Nährwerte gelten pro Portion** und stammen von der Quelle — ungeprüft.
- **Der Ingest liest `nutrition`, `servings`, `prepMinutes`, `cookMinutes` und
  den Zubereitungs-Body nicht** (siehe Import-Contract §4). Die Felder stehen
  für die Obsidian-Kochansicht in der Notiz; im Dashboard wirken `name`, `id`,
  `rating`, `simple`, `reheatable`, `tags` und `ingredients`.

## 4. Technisches

- Reine Logik + Tests: `web/src/lib/services/recipeImport.ts` (+ `.test.ts`)
- CLI: `web/prisma/importRecipe.ts` → `npm run import:recipe`
- Server-Action: `importRecipeUrlAction` in `web/src/app/actions/recipes.ts`
- UI: `web/src/components/RecipeUrlImport.tsx` (Mobile-Seite *Essensplan*)
- Voraussetzung: `RECIPE_VAULT_PATH` in `web/.env` (derselbe Ordner wie beim
  Vault-Ingest). Der Importer schreibt nur Dateien — die DB-Spiegelung macht
  weiterhin `ingestVault` (Vault = Wahrheit, DB = Cache).
