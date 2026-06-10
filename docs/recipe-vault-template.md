# Rezept-Vorlage (`_template.md`)

Diese Datei als `_template.md` in den Obsidian-Rezepte-Vault legen und pro neuem
Rezept duplizieren. Dateien, die mit `_` beginnen, werden vom Ingest übersprungen.

Pflichtfeld: `name`. `id` ist empfohlen (stabiler Anker; fehlt sie, wird der
Dateiname als Slug genutzt). `rating` ∈ favorit | ok | selten (Default ok).
`freshness` pro Zutat ∈ frisch | haltbar (optional).

```markdown
---
id: mein-rezept-slug
name: Mein Rezept
rating: ok
simple: true
reheatable: false
tags: [schnell, vegetarisch]
servings: 4
prepMinutes: 15
cookMinutes: 25
nutrition:
  kcal: 540
  protein: 22
ingredients:
  - { name: Nudeln, amount: 500, unit: g, freshness: haltbar }
  - { name: Tomaten, amount: 6, unit: Stk, freshness: frisch }
---

## Zubereitung
1. …
2. …
```
