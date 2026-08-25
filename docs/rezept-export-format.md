# Rezept-Export: Dateiformat

Was `npm run export:recipes` nach `RECIPE_EXPORT_PATH` schreibt — eine
Markdown-Datei pro Rezept, nächtlich erneuert durch `scripts/tablet-backup.sh`.

**Richtung beachten:** Die DB ist die Wahrheit. Hier wird nur geschrieben, nie
gelesen. Wer eine dieser Dateien bearbeitet, ändert nichts an der App — der
nächste Export überschreibt sie wieder. Rezepte werden in der App gepflegt
(*Essen → Rezepte*).

Dies ersetzt den früheren Obsidian-Vault-Contract, in dem es andersherum lief
(Vault = Wahrheit, DB = Cache). Das Format ist absichtlich dasselbe geblieben:
So bleiben die Dateien in Obsidian lesbar, und `RECIPE_EXPORT_PATH` darf der
alte Vault-Ordner sein.

---

## Beispiel

```markdown
---
id: gemuese-curry-mit-kokosmilch
name: Gemüse-Curry mit Kokosmilch
rating: ok
simple: true
reheatable: false
tags:
  - kalorienarm
  - vegetarisch
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 420
  protein: 18
source: https://www.chefkoch.de/rezepte/…
ingredients:
  - name: Kokosmilch
    amount: '400'
    unit: ml
  - name: Spinat
exportedBy: haushalts-dashboard
---

## Zubereitung

1. Zwiebeln anschwitzen.
2. Kokosmilch zugeben.

## Notizen

Mit Limette abschmecken.

## Quelle

https://www.chefkoch.de/rezepte/…
```

## Felder

| Feld | Bedeutung |
|---|---|
| `id` | Slug des Rezepts. Fehlt bei Rezepten, die in der App angelegt wurden — die haben keinen. |
| `name` | Immer vorhanden. |
| `rating` | `favorit` \| `ok` \| `selten`. Steuert die Gewichtung im Essensplan. |
| `simple`, `reheatable` | Immer vorhanden. |
| `tags` | Nur wenn vorhanden. |
| `servings`, `prepMinutes`, `cookMinutes` | Nur wenn gesetzt. |
| `nutrition.kcal`, `nutrition.protein` | Pro Portion. Nur wenn gesetzt; einzeln möglich. |
| `source` | Herkunfts-URL des Link-Imports. |
| `archived` | Nur bei ausgemusterten Rezepten (`true`). Sie kommen mit ins Backup — ein Backup, das stillschweigend Daten weglässt, ist keines. |
| `ingredients` | `name` immer, `amount`/`unit` nur wenn gesetzt. Reihenfolge wie im Rezept. |
| `exportedBy` | Signatur des Exports. Siehe unten. |

Leere Felder stehen **nicht** als `null` in der Datei, sie fehlen schlicht.
Der Body enthält nur die Abschnitte, die es gibt.

**Nicht enthalten:** das Rezeptbild (liegt in `RECIPE_IMAGE_DIR`) und die
internen Ids. Zum Zurückspielen ist die datierte `prod.db`-Kopie da, die
`tablet-backup.sh` daneben ablegt; diese Dateien sind zum Lesen.

## Zwei Eigenschaften, auf die sich der Export verlässt

**Deterministisch.** Gleiches Rezept ⇒ byte-gleiche Datei; es steht bewusst
kein Exportzeitpunkt drin. Nur dadurch kann der Export unveränderte Dateien in
Ruhe lassen, statt Obsidian Sync jede Nacht den kompletten Ordner neu
übertragen zu lassen.

**Signiert.** `exportedBy: haushalts-dashboard` markiert die Datei als von uns
erzeugt. Verwaiste Exportdateien — umbenannte oder gelöschte Rezepte — räumt
der Export weg, aber **nur** solche mit dieser Signatur. Fremde `.md` im
Ordner werden gemeldet und nie angefasst; `_`-Dateien (Obsidian-Vorlagen)
bleiben ganz außen vor. Das ist der Grund, warum `RECIPE_EXPORT_PATH` gefahrlos
auf einen Ordner mit handgepflegten Notizen zeigen darf.

Beim ersten Lauf im alten Vault-Ordner heißt das: die Altbestände von vor dem
Cutover bleiben liegen und werden als „nicht von uns" gemeldet. Sie lassen sich
löschen, sobald der Export einmal durchgelaufen und geprüft ist.

## Code

- Serialisierung (rein, getestet): `web/src/lib/services/recipeMarkdown.ts`
- Export + Aufräumen: `web/src/lib/repositories/recipeExport.ts`
- CLI: `web/prisma/exportRecipes.ts` → `npm run export:recipes`
- Nächtlich: `scripts/tablet-backup.sh`
