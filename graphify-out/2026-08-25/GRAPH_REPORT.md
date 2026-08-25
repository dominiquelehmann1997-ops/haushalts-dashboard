# Graph Report - haushalts-dashboard  (2026-08-09)

## Corpus Check
- 246 files · ~148,177 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1971 nodes · 2712 edges · 485 communities (160 shown, 325 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 11 edges (avg confidence: 0.67)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `7c3642f0`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- meals.ts
- Kalender_IDs.txt — Google Calendar IDs
- notes.ts
- recipeIdeas.ts
- calendarSync.test.ts
- db.ts
- client
- TaskDurationsControl.tsx
- Haushalts-Dashboard — Design-Spezifikation
- after
- recurrence.test.ts
- planning.test.ts
- Einkaufs-Rutschen / Batch-Push an Bring (D-Naht)
- weatherCheck.ts
- compilerOptions
- capacity.ts
- pushNotify.test.ts
- Baby-Wetter / Kleidungsempfehlung Plan
- calendar.test.ts
- overdueCatchup.test.ts
- C2 · Benachrichtigung aufs Handy — Web-Push für den Essensplan-Entwurf
- tasks.write.test.ts
- shopping.ts
- tasks.test.ts
- chores.test.ts
- recurrence.ts
- db.ts
- calendar.ts
- clearFixture
- choreImport.test.ts
- dependencies
- bring-list-uuids.mjs
- dashboard.tsx
- WeatherBabyTile.tsx
- index.test.ts
- Design: Tablet-Betrieb + Chore-Import
- devDependencies
- bring-read-list.mjs
- after
- sw.js
- icons.tsx
- gen-icons.mjs
- layout.tsx
- manifest.test.ts
- calendarSync.ts
- page.tsx
- Haushalts-Dashboard: PWA + Tailscale-Fernzugriff + Tablet-Kiosk-Autostart
- Haushalts-Dashboard — Umsetzungsplan
- child
- ideas
- addManualEntryAction
- [approved, setApproved]
- PWA + Tailscale Remote Access + Tablet Kiosk Autostart — Implementation Plan
- Handy-Vollsteuerung Implementation Plan
- BusyWindow
- openMeteo.ts
- noRecent
- Design — Essensplan-Entwurf + Abnicken/Ändern (Roadmap-Schritt C1)
- globalSetup.ts
- Tablet Remote Access via Cloudflare Tunnel
- TodayView.tsx
- doneCount
- MealWeekList.tsx
- full
- rhythm.ts
- active
- dashboard.tsx
- Design — Dienstplan-bewusster Essensplan (Roadmap-Schritt B)
- Essensplan-Entwurf + Abnicken/Ändern (Roadmap C1) — Implementation Plan
- types.ts
- page.tsx
- accounts.test.ts
- Design — Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap-Schritt D1)
- pushToBringAction
- Google Kalender — Termine, intelligente Verteilung & Sync — Design
- Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap D1) — Implementation Plan
- eslintConfig
- nextConfig
- config
- File Structure
- sw.test.ts
- Global Constraints
- Rezepte-Vault (Obsidian) — Design
- Sanftes Lernen — Design
- scripts
- Rezept-Vault Import-Contract
- Google Calendar Setup (Phase 4 — read-only sync)
- Kompakt-Dashboard fürs Tablet — Implementation Plan
- google.ts
- Global Constraints
- THEME_INIT_SCRIPT
- Kompakt-Dashboard fürs Tablet — Design
- THEME_INIT_SCRIPT (pre-paint theme script)
- tasks.ts
- revalidateDashboard
- Catch-up überfälliger Chores + Aufgaben-Übernahme — Design
- planning.test.ts
- MobileNotesPage
- deleteShoppingAction
- clearShoppingAction
- toggleShoppingAction
- Dienstplan-bewusster Essensplan — Implementation Plan
- domain.ts (re-exports UI DTOs from data.ts)
- Rezepte-Vault V1 Implementation Plan
- Handy-Vollsteuerung (Mobile Control v2)
- Web Push / VAPID — Setup & Operations
- Prompt für Claude — Visuelles Design „Haushalts-Dashboard"
- Baby-Wetter / Kleidungsempfehlung — Feature-Plan
- Catch-up überfälliger Routinen + Aufgaben-Übernahme — Implementation Plan
- Spike: Bring!-Integration – Machbarkeit eines inoffiziellen API-Push (2026-06-07)
- planning.ts
- Essensplan-Gewichtung (Feature A) — Implementierungsplan
- README.md
- rollover.test.ts
- Handoff-Prompt — Haushalts-Dashboard in neuem Chat weiterführen
- Initialisierungs-Prompt — Rezept-Importer (ReciMe-Klon → Obsidian)
- Handy-Steuerungsoberfläche (Mobile Control)
- Rezept-Vault Schema (TS-Interface + JSON-Schema)
- Handy-Steuerungsoberfläche Implementation Plan
- Komponenten
- Neues Backend
- package.json
- AGENTS.md
- graphify.md
- graphify.md
- CLAUDE.md
- recipe-vault-template.md
- tablet-boot.sh
- tablet-start.sh
- tablet-sync.sh
- tailwindcss
- approveDraftAction
- discardDraftAction
- generatePlanAction
- pushMealIngredientsAction
- rerollDraftDayAction
- setActiveDayRecipeAction
- setDraftDayRecipeAction
- acceptRecipeIdeaAction
- generateRecipeIdeasAction
- completeTaskByAction
- completeTaskByBothAction
- deferTaskAction
- App Icon / Brand Mark (Home glyph)
- failTaskAction
- toggleTaskAction
- web/AGENTS.md — Safe Development Workflow
- Next.js-Breaking-Changes-Leseregel (node_modules/next/dist/docs)
- Safe Development Workflow (isolierter Worktree + getrennte DB)
- better-sqlite3 Driver-Adapter umgeht Rust-Query-Engine auf Android
- Bring! inoffizielle REST-API (Push mit Fallback-Pflicht)
- Spike: Bring!-Integration Machbarkeit
- buildChoreTasks (17 Haushalts-Chores, gestaffelt)
- subscribePushAction / unsubscribePushAction
- pushNotify-Service (sendToAdults, web-push)
- PushSetupControl (Client-Komponente)
- PushSubscription Prisma-Modell + Repository
- C2 · Benachrichtigung aufs Handy — Web-Push Design
- VAPID-Keypaar (Web-Push-Auth)
- completeTaskBy / completeTaskByAction
- rollOverdueRoutines Service
- classifyFreshness (Keyword-Heuristik Haltbarkeit)
- classifyShift (reine Schicht-Klassifizierung)
- Claude Design-Prompt (Visuelles Design)
- web/CLAUDE.md
- Cloudflare Named Tunnel (userspace, kein root)
- Elternzeit-/Phasen-Modus (Fairness-Ziel je Lebensphase)
- Verteil-Engine „Fairness-Konto"
- Nordstern: Mental Load reduzieren
- Haushalts-Dashboard Umsetzungsplan
- deriveDayConstraints (Koch-Constraints aus Schichten)
- Dienstplan-bewusster Essensplan Plan
- Design — Dienstplan-bewusster Essensplan
- classifyShift (Schicht-Klassifizierung)
- deriveDayConstraints (needsSimple/needsReheatable)
- Design — Einkauf nach Haltbarkeit, gestaffelt auf Bring (D1)
- classifyFreshness (Frisch/Haltbar-Heuristik)
- FreshShoppingControl (manueller Frisch-Push)
- pushRecipeBatch(category) — gestaffelter Bring-Push
- Elternzeit-Modus (Aufgabenverteilung zugunsten Emely)
- Design — Essensplan-Entwurf + Abnicken/Ändern (C1)
- approveDraft (Entwurf → aktiver Plan)
- discardDraft (Entwurf verwerfen)
- MealDraftPanel (Entwurfs-Karte)
- rerollDraftDay (Tag neu würfeln)
- Essensplan-Entwurf + Abnicken/Ändern Plan (C1)
- Essensplan-Gewichtung Plan (Feature A)
- Verteil-Engine „Fairness-Konto"
- Haltbarkeits-Korrektur-Gedächtnis Plan (FreshnessOverride, C1 sanftes Lernen)
- Google Calendar Read-Only OAuth Sync (getrennte Kalender pro Person)
- Google Calendar Setup (Phase 4)
- Einkauf Haltbarkeit-Batching Plan (D1)
- Handoff-Prompt (Dashboard weiterführen)
- MobileNavBar (Bottom-Navigation)
- Route Group (mobile) + eigenes Layout
- Handy-Steuerungsoberfläche (Mobile Control) — Design
- createTask Repository + addTaskAction
- generateNextOccurrence (Recurrence-Restart + EWMA)
- learnedInterval EWMA (pure function)
- listOpenTasks Repository
- MoreView (Handy Mehr-Seite)
- Notes CRUD Repository + Actions
- PageHeader (Mobile CardHead-Stil)
- revalidateDashboard() Helper
- ShoppingView (Handy Einkauf-Seite)
- TasksView (Handy Aufgaben-Seite)
- TodayView (Handy „Heute"-Seite)
- Handy-Vollsteuerung (Mobile Control v2) — Design
- importChores (idempotenter Chore-Upsert)
- ingestVault (Vault → DB Spiegelung, Upsert/Archiv)
- capacity.ts dayLoad/activeDayWindow
- planTask (harte Sperre ≥80% + weicher Bias)
- selectByFairness mit loadPenalty
- SyncButton (Tablet + Handy)
- syncCalendarAction (Sync+Re-Plan+Revalidate)
- Google Kalender — Termine, Verteilung & Sync — Design
- TaskActionMenu (Long-Press-Popover)
- taskDefer-Service (nextSensibleDay + deferTask)
- TopbarStats (Kennzahl-Chips)
- Weather-Komponente (baby-frei)
- Viewport-fixes CSS-Grid (3 Höhenzonen, kein Seiten-Scroll)
- FreshnessOverride-Tabelle
- learnedLeadTime (Feature C2: gelernter Einkaufs-Vorlauf)
- resolveFreshness (Feature C1: Override-Gedächtnis)
- Prinzip „Sanftes Lernen" (gedämpft, Heuristik-Fallback)
- weightedPick (Feature A: Essensplan-Gewichtung)
- Meal (type)
- Note (type)
- Task (type)
- THEME_KEY (localStorage key)
- MealPlanEntry.status (active/draft Koexistenz)
- MobileMealsPage
- Mental-Load-Reduktion (Leitprinzip)
- MobileLayout
- parseRecipeMarkdown (reine Vault-Parsing-Logik)
- PWA-Manifest (installierbare Vollbild-App)
- PWA + Tailscale + Kiosk Autostart — Implementation Plan
- manifest.webmanifest (PNG-Icons)
- public/sw.js (Service Worker)
- Haushalts-Dashboard: PWA + Tailscale + Kiosk-Autostart — Design
- Fully Kiosk Browser Autostart
- tailscale serve HTTPS-Proxy (MagicDNS)
- Termux:Boot Autostart-Flow
- README.md — Haushalts-Dashboard
- ReciMe-Klon Konzept (Share-Intent → KI-Rezept → Obsidian)
- Rezept-Importer Init-Prompt (ReciMe-Klon)
- Rezept-Vault Schema (TS + JSON-Schema)
- Rezept-Vorlage (_template.md)
- resolveFreshness (Override schlägt Heuristik)
- Dashboard-Roadmap: Handy-Steuerung & Essensplan (Roadmap-Quelle)
- Backlog: Handy-Steuerung/Essensplan/Einkauf Roadmap
- RootLayout
- Spec: 2026-06-10-sanftes-lernen-design.md
- MobileSettingsPage
- Slug/ID als Identitäts-Anker
- generateRecipeIdeas() [Claude CLI OAuth]
- Tablet-Betrieb + Chore-Import Plan
- Chore-Import-Skript (17 Tasks, idempotent)
- Recurrence-Engine (nextDueDate, RHYTHM_OFFSET_DAYS)
- Warum nicht Tailscale — Android 16 netlink-Blocker
- Token-/Kosten-sparsame KI-Nutzung (Deterministisch vor LLM)
- „Vault = Wahrheit, DB = Cache"
- Claude-Skill „Rezept → Vault-Markdown" (Stufe 1.5)
- parseRecipeMarkdown (Ingest)
- Rezept-Markdown-Schema (Frontmatter)
- isMainModule
- [meals, draft, recipes]
- [pending, startTransition]
- PILL
- alreadyPushed
- bringFailed
- [copied, setCopied]
- open
- [openDay, setOpenDay]
- [pending, startTransition]
- PILL
- [pushResult, setPushResult]
- result
- [acceptingId, setAcceptingId]
- [error, setError]
- [ideas, setIdeas]
- [pending, startTransition]
- PILL
- st
- [status, setStatus]
- openCount
- p
- DEFAULT_LAT
- DEFAULT_LON
- FORECAST_URL
- current
- days
- dry
- dryCurrent
- dryFixture
- noCurrent
- noSun
- result
- today
- before
- client
- dayOfWeek
- draft
- earlyEnd
- earlyStart
- end
- entry
- isWeekday
- map
- monday
- mondayMeal
- names
- nextMon
- plan
- recipes
- sat
- seeded
- skipped
- { start }
- { start: monday }
- sun
- target
- thu
- thuEnd
- thuStart
- todays
- tue
- wed
- CURRY
- dir
- dir2
- emptyDir
- ORIG
- report
- seed
- SUPPE
- client
- mine
- parent
- rows
- templates
- before
- brot
- client
- items
- mehl
- tomaten
- allRecipes
- before
- client
- monday
- nextWeek
- ok
- others
- pizza
- recipe
- { start }
- updated
- { calls, push }
- client
- end
- entry
- names
- nudeln
- recipe
- res
- { start }
- updated
- wednesday
- active
- after
- afterMonday
- all
- allRecipes
- before
- beforeMonday
- cclient
- client
- constraints
- drafts
- entries
- entries2
- identityNames
- identityPlan
- monday
- monday2
- mondayRecipe
- names
- recipe
- second
- shuffledNames
- shuffledPlan
- sorted
- { start, end }
- { start: monday }
- today
- tuesday
- wed
- weekdays
- RATING_WEIGHTS
- RECENCY_FLOOR
- RECENCY_RAMP_DAYS
- pool
- recent
- variety
- VARIETY_DECAY
- VARIETY_FLOOR
- md
- prompt
- raw
- { recipe, errors }
- md
- { recipe }
- { recipe, errors }
- sunrise
- sunset
- THEME_KEY
- THEME_KEY / ThemePref / THEME_INIT_SCRIPT
- weightedPick (gewichtetes Roulette-Rad, Rating+Recency)
- Zwiebelprinzip (Baby-Kleidungsschichten)

## God Nodes (most connected - your core abstractions)
1. `revalidateDashboard()` - 39 edges
2. `resetDatabase()` - 25 edges
3. `createTestClient()` - 24 edges
4. `dayBounds()` - 21 edges
5. `currentWeekBounds()` - 16 edges
6. `compilerOptions` - 16 edges
7. `Haushalts-Dashboard — Umsetzungsplan` - 16 edges
8. `Handy-Vollsteuerung Implementation Plan` - 16 edges
9. `PersonKey` - 14 edges
10. `getActivePhase()` - 14 edges

## Surprising Connections (you probably didn't know these)
- `rollOverdueRoutines()` --indirect_call--> `task()`  [INFERRED]
  web/src/lib/services/overdueCatchup.ts → web/src/lib/engine/personFilter.test.ts
- `Kalender_IDs.txt — Google Calendar IDs` --shares_data_with--> `calendarSync-Service (syncCalendar)`  [INFERRED]
  web/Kalender_IDs.txt → docs/superpowers/plans/2026-06-20-google-kalender-verteilung-sync.md
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  web/prisma/importChores.ts → web/package.json
- `main()` --references--> `@prisma/client`  [EXTRACTED]
  web/prisma/seed.ts → web/package.json
- `deleteRoutineTemplate()` --references--> `@prisma/client`  [EXTRACTED]
  web/src/lib/repositories/tasks.ts → web/package.json

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Essensplan: Entwurf generieren -> Abnicken -> pro Gericht auf Bring pushen** — mealspage_MobileMealsPage, web_src_components_mealdraftpanel_mealdraftpanel, actionsMeals_generatePlanAction, actionsMeals_approveDraftAction, web_src_components_mobile_mealweeklist_mealweeklist, actionsMeals_pushMealIngredientsAction [INFERRED 0.85]
- **Design-Flackern verhindern: Pre-Paint-Skript + gecachter Wert (Tablet-Auto + Handy-Toggle)** — rootlayout_RootLayout, mobilelayout_MobileLayout, web_src_components_dashboard_usesuntheme, web_src_components_mobile_themetoggle_themetoggle, libTheme_THEME_INIT_SCRIPT, libTheme_THEME_KEY [INFERRED 0.85]
- **Weighted recipe-selection subsystem (rating + recency + variety roulette)** — web_src_lib_services_mealplanner_generateweekplan, web_src_lib_services_mealdraft_rerolldraftday, web_src_lib_services_mealweights_weightedpick, web_src_lib_repositories_meals_recentrecipeuse [INFERRED 0.90]
- **Shared vault Markdown recipe format (read + generate paths)** — web_src_lib_services_recipevault_parserecipemarkdown, web_src_lib_repositories_recipeingest_ingestvault, web_src_lib_services_recipeideas_recipeideatovaultmarkdown [INFERRED 0.90]
- **Weather-driven tablet dark/light auto-theme** — web_src_integrations_weather_openmeteo_mapcurrent, web_src_lib_suntheme_isdarkbysun, web_src_lib_theme_themeconstants [INFERRED 0.85]
- **Essensplan-Pipeline Evolution (Schicht-Constraints → Entwurf/Freigabe → Haltbarkeit-Batching → Gewichtung)** — dienstplanessensplan_plan, essensplanentwurf_plan, haltbarkeitbatching_plan, essensplangewichtung_plan [INFERRED 0.85]
- **Essensplan-Entwurf → Abnicken/Ändern → Handy-Push-Benachrichtigung** — entwurfspec_approvedraft, entwurfspec_mealdraftpanel, c2planpush_pushnotifyservice [INFERRED 0.85]
- **Hybrid-Tageskapazität: dayLoad + planTask + selectByFairness** — kalendersyncplan_capacitydayload, kalendersyncplan_plantask, kalendersyncplan_selectbyfairness [EXTRACTED 1.00]
- **Handy-Vollsteuerung: Heute/Aufgaben/Einkauf/Mehr-Seiten** — handyvollplan_todayview, handyvollplan_tasksview, handyvollplan_shoppingview, handyvollplan_moreview [EXTRACTED 1.00]

## Communities (485 total, 325 thin omitted)

### Community 0 - "meals.ts"
Cohesion: 0.07
Nodes (62): approveDraftAction(), discardDraftAction(), generatePlanAction(), pushMealIngredientsAction(), rerollDraftDayAction(), setActiveDayRecipeAction(), setDraftDayRecipeAction(), MobileMealsPage() (+54 more)

### Community 2 - "notes.ts"
Cohesion: 0.14
Nodes (20): createNoteAction(), deleteNoteAction(), togglePinNoteAction(), updateNoteAction(), MobileNotesPage(), [draft, setDraft], [editing, setEditing], NoteItem() (+12 more)

### Community 3 - "recipeIdeas.ts"
Cohesion: 0.09
Nodes (35): main(), acceptRecipeIdeaAction(), generateRecipeIdeasAction(), IdeasResult, ingestVaultAction(), RecipeIdeasControl(), Status, PILL (+27 more)

### Community 4 - "calendarSync.test.ts"
Cohesion: 0.24
Nodes (11): RFC-3339, BABY_ARZT_PATTERN, CALENDAR_API_BASE, deriveKind(), derivePersonKey(), fetchEvents(), GoogleEvent, GoogleEventTime (+3 more)

### Community 5 - "db.ts"
Cohesion: 0.05
Nodes (57): main(), main(), syncCalendarAction(), GET(), POST(), runSync(), CalendarEventInput, OpenMeteoFixture (+49 more)

### Community 7 - "TaskDurationsControl.tsx"
Cohesion: 0.22
Nodes (13): createRoutineAction(), deleteRoutineAction(), RoutineFieldsInput, toWeatherCondition(), updateRoutineAction(), RoutineCreateForm(), AllowedPersons, createRoutineTemplate() (+5 more)

### Community 8 - "Haushalts-Dashboard — Design-Spezifikation"
Cohesion: 0.06
Nodes (31): 10 · Spätere Ausbaustufen (nicht jetzt), 1 · Ziel & Leitprinzip, 2 · Umfang & Nicht-Ziele, 3 · Nutzerkontext, 4 · Layout & Bildschirmbereiche (Layout C — „Heute" im Fokus), 5.1 Aufgaben, 5.2 Verteil-Engine „Fairness-Konto" (Herzstück), 5.2a Elternzeit-/Phasen-Modus (+23 more)

### Community 10 - "recurrence.test.ts"
Cohesion: 0.09
Nodes (21): chainBase, client, completedAt, created, days, dome, due, dueDate (+13 more)

### Community 11 - "planning.test.ts"
Cohesion: 0.08
Nodes (21): balances, both, busy, client, d, decisions, dryDay, effortFirst (+13 more)

### Community 13 - "weatherCheck.ts"
Cohesion: 0.21
Nodes (12): DayForecast, checkWeather(), fromLocalDateKey(), hasConflictingRain(), satisfies(), BASE, forecast, task (+4 more)

### Community 14 - "compilerOptions"
Cohesion: 0.06
Nodes (30): dom, dom.iterable, esnext, **/*.mts, .next/dev/types/**/*.ts, next-env.d.ts, .next/types/**/*.ts, node_modules (+22 more)

### Community 15 - "capacity.ts"
Cohesion: 0.20
Nodes (9): ACTIVE_END_HOUR, ACTIVE_START_HOUR, coveredMs(), dayLoad(), PERSONS, all, busy, load (+1 more)

### Community 16 - "pushNotify.test.ts"
Cohesion: 0.18
Nodes (15): deleteSubscription(), getAllSubscriptions(), PushSubscriptionInput, StoredSubscription, ensureVapid(), isPushConfigured(), PushPayload, sendToAdults() (+7 more)

### Community 19 - "overdueCatchup.test.ts"
Cohesion: 0.11
Nodes (17): client, dome, fu, future, newer, newerRow, parent, parentRow (+9 more)

### Community 20 - "C2 · Benachrichtigung aufs Handy — Web-Push für den Essensplan-Entwurf"
Cohesion: 0.07
Nodes (27): A · Dienst-Zeiten + Schlaf — ✅ ERLEDIGT (2026-06-08), B · Dienstplan-bewusster Essensplan — ✅ ERLEDIGT (2026-06-09), Backlog / Roadmap — Handy-Steuerung, dienstplan-bewusster Essensplan & Einkauf, C1 · Entwurfs-Zustand + Abnicken/Ändern — ✅ ERLEDIGT (2026-06-09), C2 · Benachrichtigung aufs Handy — ✅ ERLEDIGT (2026-06-18), C3 · Automatischer Auslöser „wenn beide zuhause" — offen, C · Essensplan-Entwurf → Push an beide Handys → abnicken/ändern, D1 · Haltbarkeits-Batching, gestaffelt auf Bring — ✅ ERLEDIGT (2026-06-09) (+19 more)

### Community 21 - "tasks.write.test.ts"
Cohesion: 0.12
Nodes (15): after, afterEntries, before, client, due, dues, entries, { id } (+7 more)

### Community 22 - "shopping.ts"
Cohesion: 0.09
Nodes (29): clearShoppingAction(), deleteShoppingAction(), pushToBringAction(), toggleShoppingAction(), BringSyncControl(), [copied, setCopied], label, [pending, startTransition] (+21 more)

### Community 23 - "tasks.test.ts"
Cohesion: 0.12
Nodes (13): after, byText, client, count, dayStart, emely, entries, expected (+5 more)

### Community 24 - "chores.test.ts"
Cohesion: 0.22
Nodes (11): main(), ensurePeople(), importChores(), PEOPLE, Summary, addDays(), buildChoreTasks(), ChoreInput (+3 more)

### Community 25 - "recurrence.ts"
Cohesion: 0.12
Nodes (20): ALPHA, learnedInterval(), MIN_INTERVALS, learned, chainCompletionGaps(), configuredIntervalDays(), DAY_MS, DAY_MS_LOCAL (+12 more)

### Community 26 - "db.ts"
Cohesion: 0.18
Nodes (10): addDays(), main(), seedDatabase(), client, progress, all, client, sub (+2 more)

### Community 27 - "calendar.ts"
Cohesion: 0.25
Nodes (8): subscribePushAction(), unsubscribePushAction(), WebPushSubscriptionJSON, getInitialStatus(), PushSetupControl(), Status, VAPID_PUBLIC_KEY, upsertSubscription()

### Community 29 - "choreImport.test.ts"
Cohesion: 0.15
Nodes (16): DashboardProps, PageHeader(), Appointment, appointments, DraftMeal, initialShopping, initialTasks, MealIngredient (+8 more)

### Community 30 - "dependencies"
Cohesion: 0.10
Nodes (21): better-sqlite3, bring-shopping, google-auth-library, gray-matter, lucide-react, next, @prisma/adapter-better-sqlite3, react (+13 more)

### Community 31 - "bring-list-uuids.mjs"
Cohesion: 0.22
Nodes (8): Bring, env, envPath, { lists }, m, mail, password, require

### Community 33 - "dashboard.tsx"
Cohesion: 0.22
Nodes (9): useSunTheme(), TopbarStats(), CardHead(), MealPlanWidget(), NotesWidget(), Meal, ProjectProgress, isDarkBySun() (+1 more)

### Community 34 - "WeatherBabyTile.tsx"
Cohesion: 0.08
Nodes (33): CloudRainGlyph(), clothing, showUv, [situation, setSituation], SITUATIONS, uv, UV_TINT, WARMTH_TINT (+25 more)

### Community 35 - "index.test.ts"
Cohesion: 0.24
Nodes (10): AccountEntryInput, CompletableTask, recordCompletion(), FULL_THRESHOLD, filterByPerson(), persons, task(), EngineTask (+2 more)

### Community 36 - "Design: Tablet-Betrieb + Chore-Import"
Cohesion: 0.09
Nodes (21): Self-Review-Notiz (vom Plan-Autor), Tablet-Betrieb + Chore-Import Implementation Plan, Task 1: Recurrence-Engine um neue Rhythmen erweitern, Task 2: Chore-Definitionen + Mapping (pure), Task 3: Import-Repository (idempotenter Upsert nach Titel), Task 4: CLI-Entrypoint + npm-Script, Task 5: PWA-Manifest + Icon + Layout-Metadata, Task 6: Termux-Runbook + Start-Skript + .env-Vorlage (+13 more)

### Community 37 - "devDependencies"
Cohesion: 0.10
Nodes (21): eslint, prisma, sharp, @tailwindcss/postcss, tsx, @types/node, @types/react, @types/web-push (+13 more)

### Community 38 - "bring-read-list.mjs"
Cohesion: 0.29
Nodes (6): Bring, env, envPath, items, m, require

### Community 40 - "sw.js"
Cohesion: 0.29
Nodes (6): CACHE, data, OFFLINE_URL, open, { request }, url

### Community 41 - "icons.tsx"
Cohesion: 0.24
Nodes (10): Header(), useClock(), CheckIcon(), MoonIcon(), RefreshIcon(), SunIcon(), WeatherGlyph(), State (+2 more)

### Community 42 - "gen-icons.mjs"
Cohesion: 0.33
Nodes (5): here, pub, src, targets, TEAL

### Community 43 - "layout.tsx"
Cohesion: 0.08
Nodes (23): setPhaseAction(), body, display, metadata, viewport, viewport, MobileSettingsPage(), ServiceWorkerRegister() (+15 more)

### Community 44 - "manifest.test.ts"
Cohesion: 0.33
Nodes (5): icons, manifest, maskable, png192, png512

### Community 45 - "calendarSync.ts"
Cohesion: 0.18
Nodes (10): CHORES, einkauf, futter, gassi, gross, klein, original, rasen (+2 more)

### Community 46 - "page.tsx"
Cohesion: 0.44
Nodes (8): MobileTodayPage(), Home(), getCurrent(), weather, getTodaysEvents(), getActiveProjectProgress(), getOpenTaskCount(), getTasksByPerson()

### Community 47 - "Haushalts-Dashboard: PWA + Tailscale-Fernzugriff + Tablet-Kiosk-Autostart"
Cohesion: 0.10
Nodes (19): Architektur, Boot-Flow (Termux:Boot), Deliverables, Detail, Display bleibt an, Eigenschaften, Entscheidungen (aus Brainstorming), Fully Kiosk Browser (Gratis-Tier) (+11 more)

### Community 48 - "Haushalts-Dashboard — Umsetzungsplan"
Cohesion: 0.11
Nodes (18): Datei-Struktur (Zielbild), Getroffene Grundsatz-Entscheidungen (mit Begründung), Haushalts-Dashboard — Umsetzungsplan, Phase 0 — Tooling & Gerüst, Phase 1 — Datenmodell & Persistenz, Phase 2 — Verteil-Engine „Fairness-Konto" (reine Logik, TDD), Phase 3 — Aufgaben-Domäne & Planungs-Service, Phase 4 — Integration: Google Calendar (read-only, OAuth, getrennte Kalender) (+10 more)

### Community 51 - "addManualEntryAction"
Cohesion: 0.13
Nodes (16): addManualEntryAction(), active, AddDoneEntry(), LoggablePerson, p, PEOPLE, AddDoneInline(), addManualEntry() (+8 more)

### Community 53 - "PWA + Tailscale Remote Access + Tablet Kiosk Autostart — Implementation Plan"
Cohesion: 0.12
Nodes (16): Authorize this device — prints a login URL. Open it, sign in with the SAME, background; on real use this is launched from the boot script (see kiosk doc)., Confirm the tablet's MagicDNS name (e.g. tablet.tail1234.ts.net):, File Structure, Google account, approve the tablet., PWA + Tailscale Remote Access + Tablet Kiosk Autostart — Implementation Plan, Self-Review Notes, Start the daemon in userspace mode (no root). Keep it running in the (+8 more)

### Community 54 - "Handy-Vollsteuerung Implementation Plan"
Cohesion: 0.12
Nodes (16): File Structure, Global Constraints, Handy-Vollsteuerung Implementation Plan, Self-Review, Task 10: Einkauf page (`ShoppingView`), Task 11: Mehr page (`MoreView` + `NotesEditor`), Task 12: Re-skin the Essen page header + final sweep, Task 1: `learnedInterval` pure function (+8 more)

### Community 55 - "BusyWindow"
Cohesion: 0.29
Nodes (7): filterByAvailability(), overlaps(), busy, persons, window, BusyWindow, PlanDueTasksOptions

### Community 56 - "openMeteo.ts"
Cohesion: 0.22
Nodes (7): googleEventsFixture, birthday, birthdayEvents, events, familyEvents, [sport], u4

### Community 58 - "Design — Essensplan-Entwurf + Abnicken/Ändern (Roadmap-Schritt C1)"
Cohesion: 0.12
Nodes (15): Architektur, Bewusst außerhalb des Scopes (YAGNI für C1), Datenmodell (Ansatz A — `status`-Feld), Design — Essensplan-Entwurf + Abnicken/Ändern (Roadmap-Schritt C1), Einkaufs-/Push-Naht (batch-vorbereitet), Fehlerfälle, Festgelegte Entscheidungen (aus Brainstorming), Pure Logik (+7 more)

### Community 59 - "globalSetup.ts"
Cohesion: 0.40
Nodes (5): globalSetup(), IMPORTANT: this must never touch `dev.db` — it always points `DATABASE_URL`, removeIfExists(), TEST_DATABASE_URL, TEST_DB_PATH

### Community 60 - "Tablet Remote Access via Cloudflare Tunnel"
Cohesion: 0.12
Nodes (15): 1. Server autostart (Termux:Boot), 2. Display autostart (Fully Kiosk Browser), Boot order race, If the kiosk shows an error page, Tablet Kiosk Autostart, Troubleshooting, Verify, Lock it down — Cloudflare Access (mandatory) (+7 more)

### Community 61 - "TodayView.tsx"
Cohesion: 0.20
Nodes (8): client, event(), events, firstFetch(), now, result, secondFetch(), titles

### Community 64 - "MealWeekList.tsx"
Cohesion: 0.22
Nodes (9): baseInput(), busy, day(), forecast, PHASE, result, task, window (+1 more)

### Community 66 - "rhythm.ts"
Cohesion: 0.22
Nodes (14): formatDue(), isPreset(), parseWeather(), PERSON_OPTIONS, RhythmPicker(), RoutineEditorCard(), WeatherFields, RoutineTemplateDTO (+6 more)

### Community 67 - "active"
Cohesion: 0.20
Nodes (8): itemCount, left, MENU_HEIGHT, MENU_MARGIN, MENU_WIDTH, menuHeight, TaskActionMenu(), top

### Community 68 - "dashboard.tsx"
Cohesion: 0.22
Nodes (13): CalendarGlyph(), Opt, AppointmentsTile(), TaskRow(), TaskTile(), Card(), p, PersonBadge() (+5 more)

### Community 69 - "Design — Dienstplan-bewusster Essensplan (Roadmap-Schritt B)"
Cohesion: 0.13
Nodes (14): 1 · `web/src/lib/calendar/shifts.ts` (rein, erweitern), 2 · `web/src/lib/services/mealConstraints.ts` (rein, neu), 3 · Schema (`web/prisma/schema.prisma`) + Migration, 4 · `web/src/lib/services/mealPlanner.ts` (erweitern), 5 · Anbindung & Anzeige, Architektur, Bewusst außerhalb des Scopes (YAGNI), Design — Dienstplan-bewusster Essensplan (Roadmap-Schritt B) (+6 more)

### Community 70 - "Essensplan-Entwurf + Abnicken/Ändern (Roadmap C1) — Implementation Plan"
Cohesion: 0.14
Nodes (13): Essensplan-Entwurf + Abnicken/Ändern (Roadmap C1) — Implementation Plan, File Structure, Self-Review (durch den Plan-Autor bereits erfolgt), Task 10: Manuelle Verifikation im laufenden Dashboard, Task 1: Schema — `MealPlanEntry.status`, Task 2: Pure `constraintFromEntry`, Task 3: Pure `planShoppingBatches` (D-Naht), Task 4: Planner schreibt Entwurf + `candidatesFor` exportieren (+5 more)

### Community 71 - "types.ts"
Cohesion: 0.20
Nodes (9): after, after1, after2, before, client, count, dome, rasen (+1 more)

### Community 72 - "page.tsx"
Cohesion: 0.25
Nodes (5): dynamic, [domeTasks, emelyTasks, appointments, meals, notes, project, openTaskCount], today, todayLabel, weather

### Community 74 - "Design — Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap-Schritt D1)"
Cohesion: 0.14
Nodes (13): Architektur, Bewusst außerhalb des Scopes (YAGNI für D1), Datenmodell, Design — Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap-Schritt D1), Fehlerfälle, Festgelegte Entscheidungen (aus Brainstorming), Reine Logik, Schritt D2/D3 — Anforderung & Naht (bewusst außerhalb D1) (+5 more)

### Community 77 - "Google Kalender — Termine, intelligente Verteilung & Sync — Design"
Cohesion: 0.14
Nodes (13): A) Auto-Sync, B1 — Neues pures Modul `src/lib/engine/capacity.ts`, B2 — `planTask` erweitern, B3 — `selectByFairness` erweitern, B4 — Wire-up, B) Termine in die Verteilung verdrahten (Hybrid Tageskapazität), Bestandsaufnahme (was schon da ist), C) Manueller Sync-Button (Handy + Tablet) (+5 more)

### Community 78 - "Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap D1) — Implementation Plan"
Cohesion: 0.15
Nodes (12): Einkauf nach Haltbarkeit, gestaffelt auf Bring (Roadmap D1) — Implementation Plan, File Structure, Self-Review (durch den Plan-Autor bereits erfolgt), Task 1: Schema — Kategorien + pushed, Task 2: Reine `classifyFreshness` + `suggestFreshShoppingDay`, Task 3: Seed setzt Zutaten-Kategorien, Task 4: `syncIngredientsToShopping` taggt Kategorie + pushed, Task 5: `pushRecipeBatch(category)` (+4 more)

### Community 82 - "File Structure"
Cohesion: 0.15
Nodes (12): Bekannte, bewusste Grenzen (nicht „fixen"), Design-Entscheidung: `Ingredient.category` = nur noch explizite Angabe, File Structure, Haltbarkeits-Korrektur-Gedächtnis (FreshnessOverride) Implementation Plan, Task 0: Feature-Branch, Task 1: Schema, Migration, Seed-Anpassung, Task 2: Reine Funktionen `normalizeIngredientName` + `resolveFreshness`, Task 3: Repository `freshnessOverride.ts` (Lesen + Toggle) (+4 more)

### Community 84 - "Global Constraints"
Cohesion: 0.15
Nodes (12): Abschluss, Global Constraints, Google Kalender — Termine, Verteilung & Sync — Implementation Plan, Spec-Coverage-Check, Task 1: Fairness — weicher Last-Bias (`loadPenalty`), Task 2: Tageskapazität — pures `capacity.ts`, Task 3: `planTask` — Hybrid-Kapazität (harte Sperre + weicher Bias), Task 4: `calendarSync`-Service extrahieren + Route refactoren (+4 more)

### Community 85 - "Rezepte-Vault (Obsidian) — Design"
Cohesion: 0.15
Nodes (13): Abschnitt 1 — Markdown-Schema, Abschnitt 2 — Identität & Ingest, Abschnitt 3 — Import-Weg (drei Stufen, nach Aufwand/Kosten gestaffelt), Build-Reihenfolge (Teilprojekt), Motivation, Nicht-Ziele, Reine Funktionen & Tests, Rezepte-Vault (Obsidian) — Design (+5 more)

### Community 86 - "Sanftes Lernen — Design"
Cohesion: 0.15
Nodes (13): Architektur, Build-Reihenfolge (3 Phasen), C1 — Haltbarkeits-Korrektur-Gedächtnis, C2 — Gelernter Einkaufs-Vorlauf, Feature A — Essensplan-Gewichtung, Feature B — Adaptives Aufgaben-Intervall, Feature C — Frische/Einkauf, Motivation (+5 more)

### Community 87 - "scripts"
Cohesion: 0.15
Nodes (13): scripts, build, dev, gen:icons, import:chores, import:recipes, lint, plan:today (+5 more)

### Community 88 - "Rezept-Vault Import-Contract"
Cohesion: 0.17
Nodes (11): 1. Datei-Regeln (Ingest-Ordnerscan), 2. Frontmatter-Felder, die der App tatsächlich etwas bedeuten, 3. Der `slug` / `id` — das Wichtigste für den Importer, 4. Felder, die NICHT eingelesen werden (aber erlaubt sind), 5. Ingest-Verhalten (damit der Importer keine Überraschungen baut), 6. YAML-Fallstricke für den generierenden Code, 7. Minimal gültiges Rezept, 8. Voll ausgestattetes Rezept (Referenz) (+3 more)

### Community 89 - "Google Calendar Setup (Phase 4 — read-only sync)"
Cohesion: 0.17
Nodes (11): 1. Create a Google Cloud project + enable the Calendar API, 2. Configure the OAuth consent screen, 3. Create an OAuth Client ID, 4. Fill in `web/.env`, 5. Connect the dashboard to Google, 6. Find your calendar IDs, 7. Fill in the calendar IDs in `web/.env`, 8. Trigger the sync (+3 more)

### Community 90 - "Kompakt-Dashboard fürs Tablet — Implementation Plan"
Cohesion: 0.17
Nodes (11): File Structure, Kompakt-Dashboard fürs Tablet — Implementation Plan, Self-Review (durchgeführt), Task 1: Wind in die Wetter-Daten, Task 2: Reines Wetter-Widget `Weather`, Task 3: „Aufschieben"-Logik (nächster sinnvoller Tag) + `deferTask`, Task 4: Nachtragen pro Person — `addTaskDoneAction` + `AddDoneInline`, Task 5: Long-Press-Menü an der Aufgabe (+3 more)

### Community 92 - "google.ts"
Cohesion: 0.24
Nodes (10): @prisma/client, @prisma/client, GET(), GET(), CALENDAR_READONLY_SCOPE, createOAuth2Client(), exchangeCode(), getAccessToken() (+2 more)

### Community 93 - "Global Constraints"
Cohesion: 0.17
Nodes (11): C2 Handy-Push (Essensplan-Entwurf) Implementation Plan, Global Constraints, Manuelle End-to-End-Verifikation (nach allen Tasks), Self-Review (vom Plan-Autor durchgeführt), Task 1: `PushSubscription`-Modell, Migration & Repository, Task 2: `web-push`-Dependency + `pushNotify`-Service, Task 3: Server Actions (subscribe/unsubscribe), Task 4: Service Worker — `push` + `notificationclick` (+3 more)

### Community 96 - "Kompakt-Dashboard fürs Tablet — Design"
Cohesion: 0.17
Nodes (11): Aufgaben-Interaktion (einziger Schreibpfad am Tablet), „Aufschieben" = automatisch sinnvoller Tag, Entfällt aus der Tablet-Ansicht, Kompakt-Dashboard fürs Tablet — Design, Komponenten-Schnitt, Layout (Querformat, 3 Zonen), Out of Scope (Folge-Projekt Handy-App), Technischer Ansatz (+3 more)

### Community 102 - "tasks.ts"
Cohesion: 0.17
Nodes (14): MobileRoutinesPage(), MobileTasksPage(), RoutinesView(), ALLOWED_PERSONS, CreateRoutineInput, CreateTaskInput, getTasksForDay(), listOpenTasks() (+6 more)

### Community 103 - "revalidateDashboard"
Cohesion: 0.18
Nodes (21): addTaskAction(), AddTaskInput, completeTaskByAction(), completeTaskByBothAction(), deferTaskAction(), failTaskAction(), toggleTaskAction(), Dashboard() (+13 more)

### Community 104 - "Catch-up überfälliger Chores + Aufgaben-Übernahme — Design"
Cohesion: 0.17
Nodes (11): Action `completeTaskByAction(id, doerKey)`, Bewusst ausgeklammert (YAGNI), Catch-up überfälliger Chores + Aufgaben-Übernahme — Design, Deploy, Feature 1 — Catch-up überfälliger Routinen, Feature 2 — Aufgaben-Übernahme, Problem, Service `rollOverdueRoutines(day, client)` (+3 more)

### Community 105 - "planning.test.ts"
Cohesion: 0.43
Nodes (6): computeShare(), PERSON_ORDER, selectByFairness(), balances, persons, Balances

### Community 111 - "Dienstplan-bewusster Essensplan — Implementation Plan"
Cohesion: 0.18
Nodes (10): Dienstplan-bewusster Essensplan — Implementation Plan, File Structure, Self-Review (durch den Plan-Autor bereits erfolgt), Task 1: `classifyShift` (reine Schicht-Klassifizierung), Task 2: `deriveDayConstraints` + Date-Helfer, Task 3: Schema-Migration (reheatable / reason / extraPortion) + Seed, Task 4: Constraint-bewusster `generateWeekPlan`, Task 5: `getDomeShiftsForWeek` Repository + `localDateKey` (+2 more)

### Community 113 - "Rezepte-Vault V1 Implementation Plan"
Cohesion: 0.18
Nodes (11): Rezepte-Vault V1 Implementation Plan, Self-Review (vom Plan-Autor durchgeführt), Task 1: `gray-matter`-Abhängigkeit hinzufügen, Task 2: Schema-Felder `slug`, `archived`, `rating` am `Recipe`-Cache, Task 3: Reine Parse-Funktionen `slugFromFilename` + `parseRecipeMarkdown`, Task 4: Ingest-Repository `ingestVault`, Task 5: Server-Action `ingestVaultAction`, Task 6: UI — `VaultIngestControl` + Einbau ins Dashboard (+3 more)

### Community 114 - "Handy-Vollsteuerung (Mobile Control v2)"
Cohesion: 0.18
Nodes (11): Architektur & Routing, Datenfluss & Echtzeit, Design-Shell (Re-Skin), Designkonzept (Quelle), Entscheidungen (Brainstorming 2026-06-18), Fehlerbehandlung, Handy-Vollsteuerung (Mobile Control v2), Out of Scope (Später-TODO) (+3 more)

### Community 115 - "Web Push / VAPID — Setup & Operations"
Cohesion: 0.18
Nodes (10): Environment Variables, Example `.env` block, Generating a VAPID Key Pair, iOS Note, Localhost vs. Cloudflare Tunnel, Overview, Production Deployment (Railway / Vercel), Revoking / Rotating Keys (+2 more)

### Community 116 - "Prompt für Claude — Visuelles Design „Haushalts-Dashboard""
Cohesion: 0.20
Nodes (9): Aufgaben-Status (visuell unterscheidbar), Konkrete Beispieldaten (Heute = Montag, 7. Juni), Layout — „Heute im Fokus", Nicht tun, Personen-Farbcodierung, Produkt, Prompt für Claude — Visuelles Design „Haushalts-Dashboard", Stil (+1 more)

### Community 117 - "Baby-Wetter / Kleidungsempfehlung — Feature-Plan"
Cohesion: 0.20
Nodes (9): Baby-Wetter / Kleidungsempfehlung — Feature-Plan, Datei-Struktur, Self-Review (Abdeckung), Spätere Ausbaustufen (nicht jetzt), Task 1 — Open-Meteo um UV-Index erweitern, Task 2 — Kleidungs-Empfehlung (reine Logik, TDD), Task 3 — UV-Schutz-Empfehlung (reine Logik, TDD), Task 4 — UI-Karte „Baby-Wetter" (+1 more)

### Community 118 - "Catch-up überfälliger Routinen + Aufgaben-Übernahme — Implementation Plan"
Cohesion: 0.20
Nodes (9): Catch-up überfälliger Routinen + Aufgaben-Übernahme — Implementation Plan, Global Constraints, Self-Review-Ergebnis, Task 0: Worktree-Setup, Task 1: Service `rollOverdueRoutines`, Task 2: Catch-up in `plan:today` + `syncCalendarAction` verdrahten, Task 3: Repo `completeTaskBy` + Server-Action `completeTaskByAction`, Task 4: UI — Übernahme-Eintrag im TaskActionMenu (+1 more)

### Community 120 - "Spike: Bring!-Integration – Machbarkeit eines inoffiziellen API-Push (2026-06-07)"
Cohesion: 0.22
Nodes (8): Client-Bibliotheken, Ergebnis / Empfehlung, Fallback-Optionen, Inoffizielle API: Endpoints & Auth-Flow, Integrations-Skizze (Empfehlung: Push umsetzen), Quellen, Risiken, Spike: Bring!-Integration – Machbarkeit eines inoffiziellen API-Push (2026-06-07)

### Community 122 - "planning.ts"
Cohesion: 0.31
Nodes (10): activeDayWindow(), planTask(), PlanResult, assignTask(), DEFAULT_PHASE, loadPhaseConfig(), parseWeatherCondition(), PlanDecision (+2 more)

### Community 123 - "Essensplan-Gewichtung (Feature A) — Implementierungsplan"
Cohesion: 0.25
Nodes (7): Essensplan-Gewichtung (Feature A) — Implementierungsplan, Task 0: Feature-Branch, Task 1: Reine Gewichtungs-Funktionen `mealWeights.ts`, Task 2: Repository-Funktion `recentRecipeUse`, Task 3: `generateWeekPlan` wählt gewichtet, Task 4: `rerollDraftDay` würfelt gewichtet, Task 5: Doku + Abschluss-Verifikation

### Community 124 - "README.md"
Cohesion: 0.25
Nodes (7): Deploy on Vercel, Getting Started, Gewichtete Essensplan-Auswahl, Haltbarkeits-Korrektur, Learn More, Rezept-Links (Obsidian öffnen), Rezepte-Vault

### Community 128 - "rollover.test.ts"
Cohesion: 0.29
Nodes (6): client, count, fromDay, task, toDay, updated

### Community 129 - "Handoff-Prompt — Haushalts-Dashboard in neuem Chat weiterführen"
Cohesion: 0.29
Nodes (6): Arbeitsweise / Regeln, Dein erster Schritt (jetzt), Handoff-Prompt — Haushalts-Dashboard in neuem Chat weiterführen, Was noch fehlt (Umfang der echten Umsetzung — aus der Spec), Was schon existiert (bitte zuerst lesen), Ziel & Kontext

### Community 131 - "Initialisierungs-Prompt — Rezept-Importer (ReciMe-Klon → Obsidian)"
Cohesion: 0.33
Nodes (5): Arbeitsweise, Harte Rahmenbedingungen, Initialisierungs-Prompt — Rezept-Importer (ReciMe-Klon → Obsidian), Projektauftrag, Wie du (Claude) starten sollst

### Community 132 - "Handy-Steuerungsoberfläche (Mobile Control)"
Cohesion: 0.33
Nodes (6): Architektur & Routing, Datenfluss & Synchronisation, Handy-Steuerungsoberfläche (Mobile Control), Navigation & Aufbau, Out of Scope (Vorerst), Ziel

### Community 133 - "Rezept-Vault Schema (TS-Interface + JSON-Schema)"
Cohesion: 0.40
Nodes (4): JSON-Schema (Draft 2020-12) — Validierungsziel für die emittierte YAML, Rezept-Vault Schema (TS-Interface + JSON-Schema), TypeScript, Validierungs-Hinweise für den Importer

### Community 135 - "Handy-Steuerungsoberfläche Implementation Plan"
Cohesion: 0.40
Nodes (4): Handy-Steuerungsoberfläche Implementation Plan, Task 1: Route Group & Mobile Layout Setup, Task 2: Mobile Root Redirect & Meals Page, Task 3: Placeholder Pages for Tasks, Notes & Settings

### Community 136 - "Komponenten"
Cohesion: 0.40
Nodes (5): Aufgaben (`TasksView`, Client-Component), Einkauf (`ShoppingView`, neu), Heute (`TodayView`, Server-Component), Komponenten, Mehr (`MoreView`, neu)

### Community 137 - "Neues Backend"
Cohesion: 0.50
Nodes (4): Adaptives Intervall (Feature B aus „Sanftes Lernen"), Neues Backend, Notizen, Tasks

### Community 138 - "package.json"
Cohesion: 0.50
Nodes (3): name, private, version

## Knowledge Gaps
- **1112 isolated node(s):** `tablet-boot.sh script`, `tablet-start.sh script`, `tablet-sync.sh script`, `eslintConfig`, `nextConfig` (+1107 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **325 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `@prisma/client` connect `google.ts` to `meals.ts`, `TaskDurationsControl.tsx`, `chores.test.ts`, `db.ts`, `dependencies`?**
  _High betweenness centrality (0.040) - this node is a cross-community bridge._
- **Why does `dependencies` connect `dependencies` to `package.json`, `google.ts`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Why does `devDependencies` connect `devDependencies` to `accounts.test.ts`, `package.json`, `calendar.test.ts`, `tailwindcss`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._
- **What connects `tablet-boot.sh script`, `tablet-start.sh script`, `tablet-sync.sh script` to the rest of the system?**
  _1112 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `meals.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06670584778136938 - nodes in this community are weakly interconnected._
- **Should `notes.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.14285714285714285 - nodes in this community are weakly interconnected._
- **Should `recipeIdeas.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08865248226950355 - nodes in this community are weakly interconnected._