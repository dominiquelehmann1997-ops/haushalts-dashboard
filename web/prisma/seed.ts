import "dotenv/config";

import { pathToFileURL } from "node:url";

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { PrismaClient } from "../src/generated/prisma/client";

// ---------------------------------------------------------------------------
// Date helpers — everything is anchored to "today" (local midnight) and the
// current ISO week (Monday–Sunday), so the seed stays reusable across runs.
// ---------------------------------------------------------------------------

/** Returns a Date at `date + days`, local midnight preserved. */
function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Wipes all tables and re-creates the full fixture dataset, anchored to the
 * runtime "today" (local midnight) and the current ISO week (Monday–Sunday).
 *
 * Single source of truth for fixtures: used by both the CLI seed entrypoint
 * (`main`, against the dev DB) and the Vitest test-DB harness (against a
 * dedicated test DB) — see `web/src/test/db.ts`. Idempotent: safe to call
 * repeatedly, also doubles as a per-test reset.
 */
export async function seedDatabase(prisma: PrismaClient) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  /** Returns a Date on `today` at the given local hour:minute. */
  function atTime(hours: number, minutes: number): Date {
    const d = new Date(today);
    d.setHours(hours, minutes, 0, 0);
    return d;
  }

  // Monday of the current ISO week containing `today`.
  const dayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, ...
  const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = addDays(today, diffToMonday);

  const weekdays = {
    mo: monday,
    di: addDays(monday, 1),
    mi: addDays(monday, 2),
    do: addDays(monday, 3),
    fr: addDays(monday, 4),
  };

  // ~3 months ago, local midnight.
  const threeMonthsAgo = new Date(today);
  threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

  console.log(`Seeding... (today = ${today.toISOString()}, monday = ${monday.toISOString()})`);

  // -------------------------------------------------------------------------
  // Idempotency: wipe all tables in FK-safe order (children before parents).
  // -------------------------------------------------------------------------
  await prisma.accountEntry.deleteMany();
  await prisma.mealPlanEntry.deleteMany();
  await prisma.ingredient.deleteMany();
  await prisma.task.deleteMany();
  await prisma.project.deleteMany();
  await prisma.calendarEvent.deleteMany();
  await prisma.shoppingItem.deleteMany();
  await prisma.recipe.deleteMany();
  await prisma.note.deleteMany();
  await prisma.phaseSetting.deleteMany();
  await prisma.person.deleteMany();

  // -------------------------------------------------------------------------
  // Person
  // -------------------------------------------------------------------------
  const dome = await prisma.person.create({
    data: { key: "dome", name: "Dome", role: "adult", colorAccent: "teal" },
  });
  const emely = await prisma.person.create({
    data: { key: "emely", name: "Emely", role: "adult", colorAccent: "coral" },
  });
  await prisma.person.create({
    data: { key: "baby", name: "Baby", role: "baby", colorAccent: "neutral" },
  });

  // -------------------------------------------------------------------------
  // Task — the 5 "today" tasks (standalone, projectId = null)
  // -------------------------------------------------------------------------
  const tMuell = await prisma.task.create({
    data: {
      title: "Müll rausbringen",
      type: "routine",
      effort: 5,
      icon: "🗑️",
      status: "done",
      allowedPersons: "both",
      assignedToId: dome.id,
      dueDate: today,
      completedAt: today,
    },
  });
  await prisma.task.create({
    data: {
      title: "Abendessen kochen",
      type: "routine",
      effort: 30,
      icon: "🍳",
      status: "open",
      allowedPersons: "both",
      assignedToId: dome.id,
      dueDate: today,
    },
  });
  await prisma.task.create({
    data: {
      title: "Bad putzen",
      type: "routine",
      effort: 25,
      icon: "🛁",
      status: "open",
      allowedPersons: "both",
      assignedToId: dome.id,
      dueDate: today,
    },
  });
  await prisma.task.create({
    data: {
      title: "Rasen mähen",
      type: "routine",
      effort: 20,
      icon: "🌱",
      status: "moved",
      allowedPersons: "dome",
      outdoor: true,
      weatherCondition: '{"noRain":true}',
      note: "Regen → Mi",
      sub: "nur Dome · Outdoor",
      assignedToId: dome.id,
      dueDate: today,
    },
  });
  await prisma.task.create({
    data: {
      title: "Wäsche zusammenlegen",
      type: "routine",
      effort: 10,
      icon: "🧺",
      status: "open",
      allowedPersons: "both",
      assignedToId: emely.id,
      dueDate: today,
    },
  });

  // -------------------------------------------------------------------------
  // Project "Babyzimmer einrichten" + 6 subtasks (projectId set, assignedTo null)
  // -------------------------------------------------------------------------
  const project = await prisma.project.create({
    data: { title: "Babyzimmer einrichten", icon: "🍼" },
  });

  const projectSubtasks: { title: string; status: "done" | "open" }[] = [
    { title: "Wickelkommode aufbauen", status: "done" },
    { title: "Vorhänge anbringen", status: "done" },
    { title: "Babybett beziehen", status: "done" },
    { title: "Steckdosen sichern", status: "done" },
    { title: "Mobile aufhängen", status: "open" },
    { title: "Wandregal montieren", status: "open" },
  ];

  for (const sub of projectSubtasks) {
    await prisma.task.create({
      data: {
        title: sub.title,
        type: "project",
        effort: 15,
        status: sub.status,
        allowedPersons: "both",
        projectId: project.id,
        assignedToId: null,
        dueDate: today,
      },
    });
  }

  // -------------------------------------------------------------------------
  // CalendarEvent
  // -------------------------------------------------------------------------
  await prisma.calendarEvent.create({
    data: {
      externalId: "seed-u4",
      calendarKey: "emely",
      title: "U4-Untersuchung",
      start: atTime(11, 0),
      end: atTime(12, 0),
      personKey: "emely",
      kind: "baby-arzt",
      place: "Kinderarzt",
    },
  });
  await prisma.calendarEvent.create({
    data: {
      externalId: "seed-sport",
      calendarKey: "dome",
      title: "Sport",
      start: atTime(18, 30),
      end: atTime(20, 0),
      personKey: "dome",
      kind: "termin",
      place: "Verein",
    },
  });
  await prisma.calendarEvent.create({
    data: {
      externalId: "seed-paket",
      calendarKey: "family",
      title: "Paket abholen",
      start: atTime(20, 0),
      end: atTime(20, 30),
      personKey: null,
      kind: "termin",
      place: "Packstation",
    },
  });

  // -------------------------------------------------------------------------
  // ShoppingItem
  // -------------------------------------------------------------------------
  const shoppingItems: { text: string; meal: boolean; done: boolean }[] = [
    { text: "Windeln Gr. 2", meal: false, done: false },
    { text: "Feuchttücher", meal: false, done: false },
    { text: "Milch", meal: false, done: true },
    { text: "Brot", meal: false, done: false },
    { text: "Tomaten", meal: true, done: false },
    { text: "Basilikum", meal: true, done: false },
    { text: "Parmesan", meal: true, done: true },
    { text: "Spülmittel", meal: false, done: false },
  ];

  for (const item of shoppingItems) {
    await prisma.shoppingItem.create({
      data: {
        text: item.text,
        meal: item.meal,
        done: item.done,
        source: item.meal ? "recipe" : "manual",
      },
    });
  }

  // -------------------------------------------------------------------------
  // Recipe (with Ingredient lists — Phase 6) + MealPlanEntry (Mo–Fr)
  // -------------------------------------------------------------------------
  const recipeNames = ["Pasta al Pomodoro", "Gemüse-Curry", "Reste", "Ofengemüse", "Pizzaabend"];
  const simpleRecipes = new Set(["Pasta al Pomodoro", "Reste"]);
  const reheatableRecipes = new Set(["Gemüse-Curry", "Ofengemüse", "Reste"]);

  // Ingredient lists per recipe — Pasta al Pomodoro intentionally includes
  // Tomaten/Basilikum/Parmesan to line up with the seeded "recipe" shopping
  // items above. "Reste" (leftovers) has none.
  const recipeIngredients: Record<string, { name: string; amount: string | null; unit: string | null }[]> = {
    "Pasta al Pomodoro": [
      { name: "Nudeln", amount: "500", unit: "g" },
      { name: "Tomaten", amount: "6", unit: null },
      { name: "Basilikum", amount: "1", unit: "Bund" },
      { name: "Parmesan", amount: "100", unit: "g" },
      { name: "Knoblauch", amount: "2", unit: "Zehen" },
      { name: "Olivenöl", amount: null, unit: null },
    ],
    "Gemüse-Curry": [
      { name: "Gemüsemischung", amount: "500", unit: "g" },
      { name: "Kokosmilch", amount: "1", unit: "Dose" },
      { name: "Currypaste", amount: "2", unit: "EL" },
      { name: "Reis", amount: "300", unit: "g" },
    ],
    Reste: [],
    Ofengemüse: [
      { name: "Kartoffeln", amount: "1", unit: "kg" },
      { name: "Karotten", amount: "4", unit: null },
      { name: "Zucchini", amount: "2", unit: null },
      { name: "Olivenöl", amount: null, unit: null },
    ],
    Pizzaabend: [
      { name: "Pizzateig", amount: "2", unit: null },
      { name: "Tomatensoße", amount: "1", unit: "Glas" },
      { name: "Käse", amount: "200", unit: "g" },
    ],
  };

  const recipesByName = new Map<string, { id: string }>();
  for (const name of recipeNames) {
    const recipe = await prisma.recipe.create({
      data: {
        name,
        simple: simpleRecipes.has(name),
        reheatable: reheatableRecipes.has(name),
      },
    });
    recipesByName.set(name, recipe);

    for (const ingredient of recipeIngredients[name] ?? []) {
      await prisma.ingredient.create({
        data: {
          recipeId: recipe.id,
          name: ingredient.name,
          amount: ingredient.amount,
          unit: ingredient.unit,
        },
      });
    }
  }

  const mealPlan: { date: Date; recipeName: string }[] = [
    { date: weekdays.mo, recipeName: "Pasta al Pomodoro" },
    { date: weekdays.di, recipeName: "Gemüse-Curry" },
    { date: weekdays.mi, recipeName: "Reste" },
    { date: weekdays.do, recipeName: "Ofengemüse" },
    { date: weekdays.fr, recipeName: "Pizzaabend" },
  ];

  for (const entry of mealPlan) {
    const recipe = recipesByName.get(entry.recipeName);
    if (!recipe) continue;
    await prisma.mealPlanEntry.create({
      data: { date: entry.date, recipeId: recipe.id, status: "active" },
    });
  }

  // -------------------------------------------------------------------------
  // Note
  // -------------------------------------------------------------------------
  await prisma.note.create({
    data: { icon: "📌", text: "Hebammen-Termin bestätigen", pinned: true },
  });
  await prisma.note.create({
    data: { icon: "🎂", text: "So: Geburtstag Oma", pinned: false },
  });
  await prisma.note.create({
    data: { icon: "🧳", text: "U-Heft einpacken", pinned: false },
  });

  // -------------------------------------------------------------------------
  // PhaseSetting — Elternzeit, Ziel 60/40, Emely betreut
  // -------------------------------------------------------------------------
  await prisma.phaseSetting.create({
    data: {
      mode: "elternzeit",
      targetDome: 60,
      targetEmely: 40,
      caregiverKey: "emely",
      activeFrom: threeMonthsAgo,
      activeUntil: null,
      isActive: true,
    },
  });

  // -------------------------------------------------------------------------
  // AccountEntry — bereits ERLEDIGTE Arbeit dieser Woche (Spec: Punkte nur
  // fürs Erledigen). Bewusst entkoppelt von den noch offenen Heute-Aufgaben:
  // nur die tatsächlich erledigte Aufgabe (Müll) trägt eine `taskId`; die
  // übrigen Buchungen stehen für früher in der Woche erledigte Arbeit.
  // Wochen-Aufteilung ≈ Dome 60 / Emely 40; occurredAt innerhalb der ISO-Woche.
  // -------------------------------------------------------------------------
  const weekTimestamp = atTime(9, 0); // any moment within the current week

  const accountEntries: {
    person: { id: string };
    label: string;
    points: number;
    source: "planned" | "betreuung";
    taskId: string | null;
  }[] = [
    // Dome: 5 + 25 + 30 = 60
    { person: dome, label: "Müll rausbringen", points: 5, source: "planned", taskId: tMuell.id },
    { person: dome, label: "Wocheneinkauf erledigt", points: 25, source: "planned", taskId: null },
    { person: dome, label: "Küche geputzt", points: 30, source: "planned", taskId: null },
    // Emely: 10 + 30 = 40
    { person: emely, label: "Wäsche gewaschen", points: 10, source: "planned", taskId: null },
    { person: emely, label: "Babybetreuung", points: 30, source: "betreuung", taskId: null },
  ];

  for (const entry of accountEntries) {
    await prisma.accountEntry.create({
      data: {
        personId: entry.person.id,
        label: entry.label,
        points: entry.points,
        source: entry.source,
        taskId: entry.taskId,
        occurredAt: weekTimestamp,
      },
    });
  }

  // -------------------------------------------------------------------------
  // Verification output
  // -------------------------------------------------------------------------
  const [
    personCount,
    taskCount,
    projectCount,
    calendarEventCount,
    accountEntryCount,
    phaseSettingCount,
    recipeCount,
    ingredientCount,
    mealPlanEntryCount,
    shoppingItemCount,
    noteCount,
  ] = await Promise.all([
    prisma.person.count(),
    prisma.task.count(),
    prisma.project.count(),
    prisma.calendarEvent.count(),
    prisma.accountEntry.count(),
    prisma.phaseSetting.count(),
    prisma.recipe.count(),
    prisma.ingredient.count(),
    prisma.mealPlanEntry.count(),
    prisma.shoppingItem.count(),
    prisma.note.count(),
  ]);

  console.log("\n--- Row counts ---");
  console.log({
    Person: personCount,
    Task: taskCount,
    Project: projectCount,
    CalendarEvent: calendarEventCount,
    AccountEntry: accountEntryCount,
    PhaseSetting: phaseSettingCount,
    Recipe: recipeCount,
    Ingredient: ingredientCount,
    MealPlanEntry: mealPlanEntryCount,
    ShoppingItem: shoppingItemCount,
    Note: noteCount,
  });

  const activePhase = await prisma.phaseSetting.findFirst({ where: { isActive: true } });
  console.log("\n--- Active PhaseSetting ---");
  console.log({
    mode: activePhase?.mode,
    targetDome: activePhase?.targetDome,
    targetEmely: activePhase?.targetEmely,
    caregiverKey: activePhase?.caregiverKey,
  });

  const sunday = addDays(monday, 6);
  const weekEnd = new Date(sunday);
  weekEnd.setHours(23, 59, 59, 999);

  const weekEntries = await prisma.accountEntry.findMany({
    where: { occurredAt: { gte: monday, lte: weekEnd } },
    include: { person: true },
  });

  const sums = new Map<string, number>();
  for (const entry of weekEntries) {
    sums.set(entry.person.key, (sums.get(entry.person.key) ?? 0) + entry.points);
  }
  const domeSum = sums.get("dome") ?? 0;
  const emelySum = sums.get("emely") ?? 0;
  const total = domeSum + emelySum;

  console.log("\n--- Weekly AccountEntry points (current ISO week) ---");
  console.log({
    dome: domeSum,
    emely: emelySum,
    domePercent: total > 0 ? Math.round((domeSum / total) * 100) : 0,
    emelyPercent: total > 0 ? Math.round((emelySum / total) * 100) : 0,
  });

  console.log("\nSeed completed.");
}

// ---------------------------------------------------------------------------
// CLI entrypoint — standalone PrismaClient against the dev DB (not the app
// singleton, so this file can run independently via `tsx prisma/seed.ts` /
// `prisma db seed`).
// ---------------------------------------------------------------------------

async function main() {
  const adapter = new PrismaBetterSqlite3({
    url: process.env.DATABASE_URL ?? "file:./dev.db",
  });
  const prisma = new PrismaClient({ adapter });

  try {
    await seedDatabase(prisma);
  } finally {
    await prisma.$disconnect();
  }
}

// Run only when executed directly (e.g. `tsx prisma/seed.ts`), not when
// imported (e.g. by the test-DB harness for `seedDatabase`).
const isMainModule = Boolean(process.argv[1]) && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMainModule) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
