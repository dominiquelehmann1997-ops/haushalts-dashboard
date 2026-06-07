# Prompt für Claude — Visuelles Design „Haushalts-Dashboard"

> Kopiere alles unterhalb der Linie in Claude (Artifacts). Der Prompt ist in sich geschlossen.

---

Du bist ein erstklassiger Produkt- und UI-Designer. Baue mir einen **vollständigen, interaktiven Design-Prototyp** für ein Haushalts-Dashboard als **einzelnes, in sich geschlossenes Artifact** (React + Tailwind). Keine Backends oder echten API-Aufrufe — alle Daten als realistische Mock-Daten direkt im Code. Das Ergebnis soll schön, modern und sofort verständlich sein.

## Produkt
Ein Haushalts-Cockpit für ein Paar mit einem **3 Monate alten Baby**: **Emely** (aktuell in **Elternzeit**, den ganzen Tag mit der Kleinen zuhause) und **Dome** (arbeitet). Es bündelt Termine, Haushaltsaufgaben, Essensplan, Einkauf, Wetter und Notizen an einem Ort.

**Oberstes Leitprinzip: den Mental Load von Emely reduzieren.** Das Dashboard wirkt ruhig, aufgeräumt und beantwortet auf einen Blick: *„Was ist heute dran — und wer macht was?"* Es soll sich anfühlen wie ein Ort, der Arbeit abnimmt — nicht wie ein volles Admin-Panel.

**Wichtiges Designprinzip:** „In Elternzeit zuhause" heißt **nicht** „frei für Hausarbeit" — Emely leistet den Tag über Betreuungsarbeit. Das Dashboard soll **sichtbar** dafür sorgen, dass nicht automatisch mehr Hausarbeit bei Emely landet. Dafür gibt es einen dezenten **„Elternzeit-Modus"**, der zeigt, dass Dome aktuell den Großteil übernimmt.

## Technik
- Einzelnes React-Artifact mit Tailwind, keine Netzwerkaufrufe.
- Alle Inhalte als Mock-Daten im Code (siehe unten).
- Leichte Interaktivität via `useState`: Aufgaben & Einkaufsartikel abhaken (Status wechselt, Häkchen + Durchstreichen).
- Responsive, keine Konsolenfehler. UI-Sprache: **Deutsch**.

## Layout — „Heute im Fokus"
Ganz oben ein **Hero-Band „Heute"** über die volle Breite, darunter eine **Widget-Reihe**.

**Hero-Band** = vier Kacheln nebeneinander:
1. **Wetter** (heute)
2. **Aufgaben Dome · heute**
3. **Aufgaben Emely · heute**
4. **Termine heute**

Direkt darunter im Hero-Band ein **„Elternzeit-Modus"-Streifen** mit der **Aufgaben-Aufteilung** als geteiltem Balken (Dome trägt aktuell mehr) + kurzer, freundlicher Erklärung.

**Widget-Reihe** darunter (vier Karten):
- **Einkaufsliste** (abhakbar, kleiner Hinweis „synct mit Bring!")
- **Essensplan** (Wochenübersicht)
- **Notizen / Schwarzes Brett**
- **Wochenübersicht** (offene Aufgaben, laufendes Projekt)

**Responsive:** Am Handy stapeln sich alle Bereiche vertikal; das Hero-Band bleibt oben. Auf großen Displays (Wandtablet in der Küche) gut aus Entfernung lesbar.

## Personen-Farbcodierung
Dome = ein Akzent (z.B. Blau/Teal), Emely = ein zweiter, wärmerer Akzent (z.B. Koralle/Rosé). Konsistent über Aufgaben, Termin-Badges und den Aufteilungs-Balken.

## Konkrete Beispieldaten (Heute = Montag, 7. Juni)

**Wetter:** 18°, bewölkt, Regen ab 16 Uhr ☔.

**Aufgaben Dome · heute** (übernimmt aktuell den Großteil)
- 🗑️ Müll rausbringen (5 Min) — *erledigt ✓*
- 🍳 Abendessen kochen (30 Min) — offen
- 🛁 Bad putzen (25 Min) — offen
- 🌱 Rasen mähen — *auf Mittwoch verschoben (Regen) ↻* (nur Dome, Outdoor)

**Aufgaben Emely · heute** (bewusst wenig & flexibel, nur während der Schläfchen)
- 🧺 Wäsche zusammenlegen (10 Min) — offen

**Termine heute**
- 11:00 U4-Untersuchung Kinderarzt — Badge: Emely + Baby
- 18:30 Sport — Badge: Dome
- 20:00 Paket abholen

**Elternzeit-Modus / Aufgaben-Aufteilung (diese Woche):** Dome 72 % · Emely 28 %. Freundlicher Hinweis: „Elternzeit-Modus aktiv — Dome übernimmt aktuell mehr, Emely ist mit der Kleinen zuhause." (Geteilter Balken in den Personenfarben.)

**Einkaufsliste** (synct mit Bring!): Windeln Gr. 2, Feuchttücher, Milch, Brot, Tomaten 🍽️, Basilikum 🍽️, Parmesan 🍽️, Spülmittel. Einige abgehakt. Zutaten aus dem Essensplan dezent mit 🍽️ markieren, manuelle/Baby-Artikel ohne.

**Essensplan (Woche, bewusst einfache & schnelle Gerichte):** Mo · Pasta al Pomodoro · Di · Gemüse-Curry · Mi · Reste · Do · Ofengemüse · Fr · Pizzaabend.

**Notizen / Schwarzes Brett:** 📌 Hebammen-Termin bestätigen · 🎂 So: Geburtstag Oma · U-Heft einpacken.

**Wochenübersicht:** 9 offene Aufgaben · laufendes Projekt „Babyzimmer fertig einrichten" (4 von 6 erledigt, kleiner Fortschrittsbalken).

## Aufgaben-Status (visuell unterscheidbar)
- **offen** — leere Checkbox
- **erledigt** — Häkchen ✓, durchgestrichen, gedämpft
- **verschoben** — ↻ mit kurzem Grund (z.B. „Regen → Mi")
- **nicht geschafft** — ⤬, dezent rot markiert

## Stil
- Modern, ruhig, freundlich — passend für eine Familie mit Neugeborenem (eher beruhigend als reizüberflutend).
- Helle Oberfläche, sanfte Karten mit abgerundeten Ecken, weiche Schatten, großzügiger Weißraum.
- Klare typografische Hierarchie; das „Heute"-Band ist visuell das Zentrum.
- Dezente Akzentfarben, kein grelles Bunt. Icons/Emojis sparsam als Orientierung.
- Light-Mode als Default (gern Dark-Mode-tauglich gestalten).

## Nicht tun
- Keine echten API-, Kalender- oder Bring-Integrationen — nur visuell andeuten.
- Kein Login, keine Einstellungsseiten — nur das Haupt-Dashboard.
- Kein Eindruck, Emely solle „mehr machen, weil sie zuhause ist" — das Gegenteil ist beabsichtigt.
- Nicht überladen; lieber klar und reduziert als vollgepackt.

Liefere das fertige Artifact. Triff dort, wo der Prompt offen ist, eigene gute Designentscheidungen.
