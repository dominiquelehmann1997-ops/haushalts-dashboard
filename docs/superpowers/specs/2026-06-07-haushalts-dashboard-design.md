# Haushalts-Dashboard — Design-Spezifikation

**Datum:** 2026-06-07
**Status:** Konzept & Spec (genehmigt zum Verschriftlichen)
**Deliverable dieser Phase:** Konzept, Feature-Liste und grobe Layout-Struktur als Dokument — **kein gebauter Code**. Der finale visuelle Look wird separat in Claude umgesetzt.

---

## 1 · Ziel & Leitprinzip

Ein responsives **Haushalts-Cockpit für ein Paar mit Baby** — **Emely** und **Dome** (3 Monate alte Tochter) —, das den kompletten Haushalt managt: Termine aus dem gemeinsamen Google-Kalender, automatisch verteilte Haushaltsaufgaben, Essensplanung und Einkauf.

**Nordstern (oberstes Leitprinzip):** **Den Mental Load reduzieren — besonders für Emely.** Das Dashboard soll *proaktiv planen*, nicht eine weitere To-do-App sein, die jemand pflegen muss. Niemand soll „die Verantwortliche" sein. Gerade jetzt — mit Neugeborenem und Emely in Elternzeit — gilt: **„zuhause" heißt nicht „frei"**; das Dashboard sorgt sichtbar dafür, dass nicht automatisch mehr Arbeit bei Emely landet. Jede Designentscheidung wird daran gemessen: Nimmt sie Planungs- und Koordinationsarbeit ab — oder erzeugt sie neue?

Die Kernfrage, die das Dashboard immer zuerst beantwortet:
> *„Was ist heute dran — und wer macht was?"*

---

## 2 · Umfang & Nicht-Ziele

**In Scope (Konzept):**
- Layout-Struktur (Layout C — „Heute" im Fokus)
- Aufgabenverwaltung mit vier Aufgabentypen, Status und Eigenschaften
- Verteil-Engine „Fairness-Konto" inkl. Personen-Filter, Wetter- und Verfügbarkeits-Prüfung
- **Elternzeit-/Phasen-Modus**: anpassbares Fairness-Ziel je Lebensphase
- Spontan-Nachtrag erledigter Aufgaben (inkl. optionaler Betreuungs-Aufgaben)
- Google-Kalender-Anbindung (read-only) als Verfügbarkeits- und Terminquelle
- Automatische Essensplanung (stufenweise)
- Automatische Einkaufsliste mit Push an Bring!
- Widgets: Wetter, Einkaufsliste, Essensplan, Notizen, Wochenübersicht
- Konzeptionelles Datenmodell und grobe Architektur

**Nicht-Ziele (dieser Phase):**
- Finaler visueller Look / Pixel-Design (wird in Claude gebaut)
- Konkrete Technologie-Wahl (Framework, Datenbank, Hosting) — bewusst offen
- Mehr als zwei Personen / komplexe Familienstrukturen
- Mobile-Native-Apps (Web/responsive genügt)

---

## 3 · Nutzerkontext

- **Haushalt:** Paar mit **3 Monate altem Baby** — **Emely** und **Dome**.
- **Aktuelle Lebensphase:** Emely ist in **Elternzeit** (den Tag über Betreuung), Dome arbeitet. Prägt die Verteilung maßgeblich (siehe §5.2a).
- **Gerät:** Responsive — vom **Wandtablet** (always-on, glanceable) bis zum **Handy** (kompakt, interaktiv). Gleichwertig.
- **Kalenderquelle:** gemeinsamer **Google Calendar**.
- **Bestehende Einkaufs-App:** **Bring!** (soll weiter genutzt werden).

---

## 4 · Layout & Bildschirmbereiche (Layout C — „Heute" im Fokus)

**Hero-Band „Heute"** (immer oben, maximal glanceable), vier Kacheln:
1. **Wetter** — aktuelles Wetter + Tagesvorhersage (auch Eingabe für die Verteilung, siehe §5.2)
2. **Aufgaben Person A · heute**
3. **Aufgaben Person B · heute**
4. **Termine heute** (aus Google Calendar, mit Personen-Zuordnung)

Darunter im Hero-Band: **Fairness-Balken** mit aktuellem Konto-Stand und Hinweis, an wen die nächste Aufgabe geht.

**Widget-Reihe darunter** (vier Bereiche):
- 🛒 **Einkaufsliste** (abhakbar, synct mit Bring!)
- 🍽️ **Essensplan** (Wochenplan, automatisch erzeugt)
- 📝 **Notizen / Schwarzes Brett**
- 🗓️ **Wochenübersicht** (offene Aufgaben, laufende Projekte)

**Responsive-Verhalten:** Am Handy stapeln sich alle Bereiche vertikal; das Hero-Band „Heute" bleibt immer zuoberst.

---

## 5 · Funktionsbereiche

### 5.1 Aufgaben

**Vier Aufgabentypen:**
1. **Wiederkehrende Routine** — fester Rhythmus (z.B. Müll wöchentlich, Wäsche 2×/Woche).
2. **Einmalige To-dos** — Einzelaufgaben ohne Rhythmus.
3. **Einkauf & Vorräte** — siehe §5.6.
4. **Größere Projekte** — Container mit mehreren Unteraufgaben (z.B. „Keller aufräumen").

**Status pro Aufgabe:**
- `offen` — eingeplant, noch nicht erledigt
- `erledigt` (✓) — schreibt Aufwandspunkte dem Konto der Person gut
- `verschoben` (↻) — automatisch auf den Folgetag gerollt (nicht erledigt)
- `nicht geschafft` (⤬) — sichtbar markiert, optional mit Grund

**Regel:** Punkte gibt es **nur fürs Erledigen**. Offene und verschobene Aufgaben rollen automatisch weiter — kein manuelles Nachhalten nötig.

**Eigenschaften pro Aufgabe:**
- **Aufwandswert** (Punkte / Minuten) — Startwerte voreingestellt, anpassbar.
- **Erlaubte Person(en)** — `beide` / `nur A` / `nur B` (Personen-Filter, siehe §5.2).
- **Outdoor / wetterabhängig** — `ja/nein` + Bedingung (Standard: „kein Regen im Zeitfenster", optional Mindesttemperatur).
- **Rhythmus** — nur bei wiederkehrender Routine.
- **Status** + optionaler **Grund**.

### 5.2 Verteil-Engine „Fairness-Konto" (Herzstück)

Jede erledigte Aufgabe schreibt ihre Aufwandspunkte dem **Konto** der erledigenden Person gut. Die Konten gleichen sich über die Zeit aus und werden als Balken angezeigt („A 120 · B 95 → nächste geht an B").

**Entscheidungs-Pipeline beim Einplanen einer fälligen Aufgabe:**

1. **Personen-Filter** — Wer *darf* die Aufgabe? (`beide` / `nur A` / `nur B`). Beispiel: „Rasen mähen = nur A" → B fällt raus.
2. **Wetter-Check** (nur bei Outdoor-Aufgaben) — Passt der Tag laut Vorhersage? Bei Regen / ungeeigneten Bedingungen wird die Aufgabe automatisch auf den nächsten geeigneten Tag **verschoben** (mit Vorschlag).
3. **Verfügbarkeit (Kalender)** — Ist die Person im geplanten Zeitfenster laut Google Calendar frei? (Event = belegt.) Belegte Personen fallen für dieses Fenster raus.
4. **Fairness-Konto (mit Ziel-Aufteilung)** — Unter den verbleibenden, verfügbaren Personen bekommt die Person, die am **weitesten hinter ihrem Ziel-Anteil** liegt, die Aufgabe. Standardziel ist 50/50; im **Elternzeit-Modus** (§5.2a) ist das Ziel bewusst zugunsten der betreuenden Person verschoben.

**Manuelles Tauschen** ist jederzeit möglich und überstimmt die Automatik.

### 5.2a Elternzeit-/Phasen-Modus

Der Haushalt durchläuft Lebensphasen mit ungleicher Kapazität. Ein **Phasen-Modus** passt das Fairness-**Ziel** an, statt stur 50/50 anzustreben.

- **Elternzeit-Modus (aktuell aktiv):** Emely ist mit dem 3 Monate alten Baby in Elternzeit. „Zuhause" heißt **nicht** „frei" — Betreuung ist echte Arbeit. Das Ziel ist daher bewusst zugunsten Emelys verschoben (Standard z.B. Dome 70 % · Emely 30 %, anpassbar). Die Engine plant Emely entsprechend **wenig** automatisch ein.
- **Sichtbar, nicht beschämend:** Das Dashboard zeigt den Modus als ruhigen Hinweis („Elternzeit-Modus aktiv — Dome übernimmt aktuell mehr"), nie als Druckmittel.
- **Optionales Nachtragen von Betreuung:** Betreuungs-/Baby-Aufgaben *können* nachgetragen werden (§5.3), um unsichtbare Arbeit sichtbar zu machen — **ohne Pflicht**.
- **Phase endet:** Mit dem Ende der Elternzeit kehrt das Ziel auf die normale Aufteilung zurück (jederzeit umstellbar).

### 5.3 Spontan-Nachtrag erledigter Aufgaben

Aktion **„Erledigt nachtragen"**: Person + Aufgabe (frei eingegeben oder aus Vorlage) + Aufwand. Die Buchung fließt **direkt ins Fairness-Konto**, auch wenn die Aufgabe nie vorgeplant war.

**Zweck (zentral fürs Mental-Load-Ziel):** macht *unsichtbare Arbeit sichtbar* und rechnet sie fair an. Das gilt ausdrücklich auch für **Betreuungs-/Baby-Aufgaben** (optional, ohne Erfassungspflicht — siehe §5.2a).

### 5.4 Kalender-Integration (Google Calendar)

- **Read-only-Sync** aus dem gemeinsamen Google-Kalender (OAuth).
- Termine erscheinen im Hero-Band („Termine heute"), möglichst mit Personen-Zuordnung.
- **Baby-/Arzttermine** (z.B. U-Untersuchungen, Kinderarzt, Hebamme) werden als eigene Terminart erkannt und hervorgehoben.
- Termine liefern die **Verfügbarkeit** für die Verteil-Engine (Event = belegtes Zeitfenster). **Ausnahme Elternzeit-Modus:** die betreuende Person gilt nicht automatisch als verfügbar, auch ohne Termin (§5.2a, §9).

### 5.5 Essensplan (stufenweise)

Das Dashboard erstellt den Wochen-Essensplan **automatisch**:
- **Stufe 1 (Start):** Wochenplan aus einem **kuratierten Rezeptbuch** (feste, gepflegte Rezept-Sammlung mit hinterlegten Zutaten). Schnell nutzbar, geringer Erstaufwand.
- **Stufe 2 (Ausbau):** **Präferenz-lernend** — einmalige/laufende Abfrage, was beide mögen/nicht mögen; daraus generiert das System passende Pläne.
- **Phasen-bewusst:** Im Elternzeit-Modus bevorzugt das System **einfache, schnelle Gerichte** (passt zum Alltag mit Neugeborenem).

### 5.6 Einkauf & Bring!-Sync

**Automatik-Flow:** Essensplan → Zutaten je Rezept automatisch extrahiert → gesammelt auf die Einkaufsliste → **Push an Bring!**.

- **Sync-Richtung:** **Dashboard → Bring (Push).** Manuell hinzugefügte Artikel und Rezept-Zutaten landen automatisch in der bestehenden Bring-Liste; eingekauft wird wie gewohnt in Bring.
- **Ergebnis:** Essen geplant + Einkauf steht in Bring, ohne dass jemand Rezepte suchen, Zutaten sammeln oder die Liste tippen muss.
- ⚠️ **Risiko:** Bring! hat keine offizielle öffentliche API (siehe §8).

### 5.7 Wetter

- Anzeige: aktuelles Wetter + Tagesvorhersage im Hero-Band.
- **Doppelrolle:** dient zusätzlich als **Eingabe** für den Wetter-Check der Verteil-Engine (§5.2).
- Datenquelle: eine Wetter-API (konkrete Wahl in der Umsetzungsphase).

### 5.8 Notizen & Wochenübersicht

- **Notizen / Schwarzes Brett:** freie Notizen, anpinnbar, mit optionalem Datum (z.B. „Vermieter anrufen", „So: Geburtstag Oma").
- **Wochenübersicht:** Anzahl offener Aufgaben, laufende Projekte, Blick auf die kommende Woche.

---

## 6 · Datenmodell (konzeptionell)

| Entität | Wesentliche Felder |
|---|---|
| **Person** | Name, Anzeigefarbe |
| **Aufgabe** | Titel, Typ, Aufwand (Punkte/Min), Rhythmus (opt.), erlaubtePersonen, outdoor + Wetterbedingung (opt.), Status, Grund (opt.), zugewiesenAn, fälligAm |
| **Projekt** | Titel → Liste von Unteraufgaben |
| **Kalendertermin** | Titel, Start, Ende, Person (opt.), Art (Termin / Baby-Arzt / …) — Quelle: Google Calendar |
| **Konto-Buchung** | Person, Aufgabe/Bezeichnung, Punkte, Zeitpunkt, Quelle (geplant / Nachtrag / Betreuung) |
| **Phasen-Einstellung** | Modus (Normal / Elternzeit), Ziel-Aufteilung (z.B. 70/30), betreuende Person, aktiv von–bis |
| **Rezept** | Name, Liste von Zutaten, (Stufe 2: Tags/Eignung) |
| **Zutat** | Name, Menge, Einheit |
| **Essensplan-Eintrag** | Tag, Rezept |
| **Vorliebe** (Stufe 2) | Person, mag / mag nicht |
| **Einkaufsartikel** | Name, Menge, Quelle (manuell/Rezept), erledigt |
| **Notiz** | Text, angepinnt (bool), Datum (opt.) |
| **Wettervorhersage** | Tag/Zeitfenster, Bedingung, Temperatur, Niederschlag |

---

## 7 · Architektur & Integrationen (grob)

Konkrete Tech-Wahl ist bewusst offen. Festgehalten werden nur die Bausteine und ihre Grenzen:

- **Frontend:** responsives Dashboard nach Layout C. Finaler Look später in Claude.
- **Gemeinsamer Datenspeicher:** für beide Personen zugänglich (eine Quelle der Wahrheit für Aufgaben, Konten, Pläne, Notizen).
- **Verteil-Engine:** eigene, klar abgegrenzte Komponente mit der Pipeline aus §5.2. Ein- und Ausgaben über eine definierte Schnittstelle (Eingang: fällige Aufgaben, Kalender-Belegung, Wetter, Konto-Stände; Ausgang: Zuweisung + geplanter Tag).
- **Essensplaner:** eigene Komponente (Stufe 1 Rezeptbuch → Stufe 2 lernend).
- **Einkaufs-Sync:** extrahiert Zutaten aus dem Essensplan → Einkaufsliste → Push an Bring.
- **Externe Integrationen:**
  - Google Calendar (OAuth, read-only)
  - Bring! (Push, inoffizielle API — siehe Risiko)
  - Wetter-API (Anzeige + Verteilungs-Eingabe)

Jede Komponente soll **einzeln verständlich und testbar** sein und über klar definierte Schnittstellen kommunizieren.

---

## 8 · Risiken & offene Punkte

- ⚠️ **Bring!-API:** Keine offizielle öffentliche API. Es existiert eine weit genutzte **inoffizielle REST-Schnittstelle** — funktioniert meist, kann aber jederzeit brechen. **In der Umsetzungsphase prüfen.** Fallback: manueller Export / Teilen in Bring.
- **Personen-Zuordnung von Kalenderterminen:** abhängig davon, wie der gemeinsame Google-Kalender strukturiert ist (getrennte Kalender pro Person vs. ein gemeinsamer). In der Umsetzung klären.
- **Wetter-API-Wahl:** Quelle, Genauigkeit, Limits noch offen.
- **Tech-Stack, Datenspeicher, Hosting:** bewusst offen, in der Planungsphase zu entscheiden.

---

## 9 · Annahmen

- **„Verfügbar"** = keine Kalender-Events im fraglichen Zeitfenster — **außer im Elternzeit-Modus**: die betreuende Person (Emely) gilt **nicht** automatisch als verfügbar, nur weil kein Termin im Kalender steht (§5.2a).
- **Outdoor-Standardbedingung** = „kein Regen im Zeitfenster"; Mindesttemperatur optional pro Aufgabe.
- **Aufwandswerte** haben sinnvolle Startwerte und sind anpassbar.
- **Zwei erwachsene Personen** (Emely & Dome) verteilen Aufgaben; das Baby (3 Mon.) ist Teil von Haushalt und Kalender, aber kein Aufgaben-Träger.

---

## 10 · Spätere Ausbaustufen (nicht jetzt)

- Essensplan Stufe 2 (präferenz-lernend).
- Vorratsverwaltung (was ist da, was geht zur Neige).
- Mehr Personen / Familienstruktur.
- Zwei-Wege-Sync mit Bring (statt nur Push), falls API es stabil zulässt.

---

*Dieses Dokument beschreibt Konzept, Verhalten und Struktur. Der finale visuelle Look wird separat in Claude umgesetzt. Nächster Schritt: Implementierungsplan (writing-plans).*
