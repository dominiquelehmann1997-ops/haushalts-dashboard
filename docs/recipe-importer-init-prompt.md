# Initialisierungs-Prompt — Rezept-Importer (ReciMe-Klon → Obsidian)

> Diesen Block in das **neue, leere Projekt** an Claude geben. Vorher diese zwei
> Dateien ins neue Repo kopieren (die KI braucht sie):
> `recipe-vault-import-contract.md` (Prosa-Vertrag) und `recipe-vault-schema.md`
> (TS-Interface + JSON-Schema).

---

## Projektauftrag

Ich baue eine **native Android-App (als APK installierbar)**, die wie die App
**ReciMe** funktioniert: Ich teile beliebige Quellen an die App — Instagram-Reels,
TikToks, Fotos/Screenshots, ggf. Web-Links — und die App erzeugt daraus per KI ein
strukturiertes Rezept und legt es **automatisch als Markdown-Datei in meinem
Obsidian-Vault** ab. Auf dem Handy will ich z.B. ein Reel direkt aus Instagram über
das Teilen-Menü an die App schicken, und kurz darauf liegt das Rezept im Vault.

Das Endergebnis hat zwei Hälften:

1. **Importer-App (Android):** Quelle teilen → KI extrahiert Rezept → `.md` in den
   Obsidian-Vault schreiben.
2. **Obsidian-Kochansicht:** Im Vault sollen die Rezepte in einer **Kochansicht**
   darstellbar sein, in der **Kochanleitung und Zutatenliste unabhängig
   voneinander scrollbar** sind (zwei Panes / getrennte Scroll-Container). Zusätzlich
   muss ich die **Portionenzahl ändern können, woraufhin sich alle Zutatenmengen
   automatisch mitskalieren**.

## Harte Rahmenbedingungen

- **Ausgabeformat ist ein Vertrag.** Die `.md`-Dateien müssen exakt dem beiliegenden
  `recipe-vault-import-contract.md` entsprechen (Frontmatter-Felder `id`, `name`,
  `rating`, `simple`, `reheatable`, `tags`, `ingredients[]` mit `name`/`amount`/
  `unit`/`freshness`). Pflicht: gültiges YAML, UTF-8, ein Rezept pro Datei, stabiles
  eindeutiges `id` (kebab-case), Dateiname ohne führenden `_`. **`id` ist der
  Identitäts-Anker und wird nie geändert.**
- **Maschinenlesbares Schema beiliegend:** `recipe-vault-schema.md` enthält das
  **TypeScript-Interface** (`RecipeFrontmatter` = was geschrieben wird, `ParsedRecipe`
  = normalisierte Referenz) und ein **JSON-Schema (Draft 2020-12)**. Nutze diese als
  Typen im Code **und** als Laufzeit-Validierung: emittierte YAML parsen → gegen das
  JSON-Schema prüfen (z.B. `ajv`) → erst dann die Datei schreiben. So fallen falsche
  Enums/Mengen/Tippfehler auf, bevor etwas in den Vault gelangt.
- **Für die Kochansicht zusätzlich nötig**, obwohl das Haupt-Dashboard sie ignoriert:
  - `servings` im Frontmatter (Basis-Portionen → Referenz fürs Skalieren).
  - Die **Kochanleitung als Markdown-Body** (z.B. nummerierte Schritte unter
    `## Zubereitung`). Optional `prepMinutes`/`cookMinutes`/`nutrition`.
  - Mengen so schreiben, dass sie maschinell skalierbar sind: `amount` möglichst als
    Zahl + separates `unit` (z.B. `amount: 400, unit: ml`). Brüche/Bereiche als
    gequoteten String (`"1/2"`, `"2-3"`).
- **Native App, die als APK auf mein Smartphone installierbar ist** und sich als
  **Android-Teilen-Ziel** registriert (Intent-Filter für `SEND`/`SEND_MULTIPLE`,
  `text/plain` für Links, `image/*` für Fotos).
- **In den Obsidian-Vault schreiben** heißt: in einen Ordner auf dem Telefon
  schreiben. Plane das Android-Scoped-Storage / Storage-Access-Framework von Anfang
  mit ein (Nutzer wählt den Vault-Ordner einmal aus, App behält persistente
  Schreibrechte). Das ist eine echte Hürde — früh klären.
- **KI ja, aber Token-/Kosten-sparsam.** Es dürfen keine nennenswerten Kosten
  entstehen. Leitprinzipien:
  - So viel wie möglich **deterministisch & on-device** vorverarbeiten, bevor ein
    LLM dran kommt: Bilder per **On-Device-OCR** (z.B. ML Kit, kostenlos, 0 Tokens);
    bei Reels/TikToks zuerst **Caption/Beschreibungstext** und ggf. on-screen-Text/
    Audio-Transkript einsammeln (Plattform-STT statt Audio an ein LLM zu schicken).
  - Dann **genau ein** LLM-Call pro Import: freier Text → striktes JSON nach
    Contract-Schema (JSON-/Tool-Mode für verlässliche Struktur, harte Token-Caps,
    kein Vision-/Video-Upload wenn der Text das Rezept schon enthält).
  - **Günstiges Modell** (Haiku-Klasse) reicht für „Text → strukturiertes Rezept".
  - Medien nur dann an ein Vision-Modell geben, wenn deterministische Extraktion
    wirklich scheitert (Fallback, nicht Default).

## Wie du (Claude) starten sollst

Nicht sofort coden. Erst Richtung klären:

1. **Brainstorming** zuerst (Intent, Scope, offene Entscheidungen): Tech-Stack-Wahl
   für die App (Kandidaten: Kotlin-nativ — stärkster Share-Intent-Support; Flutter
   mit `receive_sharing_intent`; React-Native/Expo — Share-Targets sind dort
   fummelig). Wäge Share-Intent-Tauglichkeit, APK-Bau, Obsidian-Plugin-Sprache
   (TypeScript) und meinen Token-Sparzwang gegeneinander ab und **gib eine klare
   Empfehlung**, keine bloße Liste.
2. Dann ein **phasenweiser Plan** (kleinste lauffähige Vertikale zuerst):
   - **Phase 1 — End-to-End-Minimum:** Foto **oder** geteilten Text an die App →
     OCR/Text → 1 LLM-Call → vertragskonforme `.md` in einen (zunächst auch lokal
     wählbaren) Ordner. Beweist die ganze Kette inkl. Vault-Schreibrechte.
   - **Phase 2 — Reels/TikTok-Links:** Caption/Transkript-Pipeline, gleiche
     LLM-Stufe.
   - **Phase 3 — Obsidian-Kochansicht:** eigenes Obsidian-Plugin (TS) mit
     Split-Pane (Anleitung ⟷ Zutaten, getrennt scrollbar) + Portions-Eingabe, die
     `ingredients[]`-Mengen live gegen `servings` reskaliert.
   - **Phase 4 — Politur & Verteilung:** Fehlerbehandlung, Duplikat-/Slug-Schutz,
     APK-Signierung & Installation aufs Gerät.
3. Für jede Phase: validiere die `.md`-Ausgabe **gegen den Vertrag**, bevor sie als
   fertig gilt. Tipp: Mains reiner Parser (`recipeVault.ts`, nur `gray-matter`, keine
   DB/Framework-Deps) lässt sich als ~100-Zeilen-Validator in dieses Projekt
   vendoren, um Ausgabe lokal zu prüfen — ohne ans Haupt-Repo zu fassen.

## Arbeitsweise

Pro Schritt: `superpowers:brainstorming` → `writing-plans` →
`subagent-driven-development` (Implementer + Spec-Review + Quality-Review je Task).
Halte den Token-Sparzwang über das ganze Projekt präsent — er ist ein
First-Class-Constraint, kein Nachgedanke.

**Erste Aktion:** Lies `recipe-vault-import-contract.md`, dann starte das
Brainstorming zu Tech-Stack & Scope und stell mir die Entscheidungsfragen, die du
zum Schärfen brauchst.
