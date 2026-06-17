# Handy-Steuerungsoberfläche (Mobile Control)

> **Status:** Design freigegeben (2026-06-17).
> Nächster Schritt: `writing-plans` → Implementierungs-Plan.

## Ziel

Das Dashboard wurde ursprünglich als "Glanceable" Tablet-Ansicht entworfen (Anzeigen von Heute, Aufgaben, Essensplan). Die aktive Eingabe und Steuerung (Aufgaben abhaken, Essenspläne "abnicken", Notizen verfassen) soll primär über das Handy der Nutzer erfolgen. 

Um das auf dem Tablet optimierte (Querformat, große Widgets) Dashboard nicht mit responsiven Kompromissen zu überladen, erhält das Handy eine dedizierte Steuerungsoberfläche, die auf mobile Eingabemuster (Hochformat, Touch, Bottom-Navigation) optimiert ist.

## Architektur & Routing

Wir nutzen den Next.js App Router, um eine saubere Trennung herzustellen:

- **Tablet (Anzeige):** Bleibt auf der Root-Route `/`.
- **Handy (Steuerung):** Bekommt eine dedizierte Route `/mobile`. Diese Route nutzt ein eigenständiges Layout (`app/(mobile)/layout.tsx`), welches nicht vom Tablet-Layout (`app/layout.tsx`) erbt.

Durch die strikte Trennung in der Route kann das Handy als separate Progressive Web App (PWA) mit der Start-URL `/mobile` auf dem Home-Screen installiert werden.

## Navigation & Aufbau

Die Handy-Ansicht nutzt eine klassische **Bottom-Navigation-Bar** (am unteren Bildschirmrand fixiert) mit vier Hauptbereichen:

1. 🍽️ **Essen (`/mobile/meals`)**
   - Ansicht des aktuellen Entwurfs oder aktiven Plans.
   - Interaktionen: "Neu würfeln", Rezepte tauschen, Plan "Abnicken" (überträgt Zutaten in die Einkaufsliste).
2. ✅ **Aufgaben (`/mobile/tasks`)**
   - Schnelle Übersicht der anstehenden Aufgaben.
   - Interaktionen: Großes "+"-Icon zum schnellen Erfassen neuer Aufgaben, Checkboxen zum Abhaken.
3. 📝 **Notizen (`/mobile/notes`)**
   - Einfache Text-Erfassung für Packlisten, Gedanken oder Einkaufs-Notizen.
4. ⚙️ **Einstellungen (`/mobile/settings`)**
   - Konfiguration der Push-Benachrichtigungen (Aktivieren/Deaktivieren).
   - System-Status (z.B. Cloudflare Tunnel, Sync).

*Das initiale Laden von `/mobile` leitet per Default auf `/mobile/meals` oder `/mobile/tasks` weiter.*

## Datenfluss & Synchronisation

- **Shared Backend:** Die `/mobile`-Routen greifen auf exakt dieselben Prisma-Modelle und Server Actions (`app/actions/...`) zu wie das Tablet.
- **Echtzeit-Gefühl:** Wenn auf dem Handy eine Server Action ausgeführt wird (z.B. "Essensplan abnicken"), invalidiert Next.js den Cache (`revalidatePath("/")`). Das Tablet aktualisiert sich beim nächsten Fetch (bzw. durch regelmäßiges Polling) automatisch.

## Out of Scope (Vorerst)

- Komplexe Kalender-Verwaltung (wird weiterhin über Google Calendar nativ gemacht).
- Eine native iOS/Android-App (wir bleiben bei PWA via Cloudflare Tunnel).
- Responsive Design des *Tablet-Dashboards* für Handys (wir bauen ja bewusst die `/mobile`-Route, um das zu vermeiden).
