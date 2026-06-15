export type PersonKey = "dome" | "emely" | "baby";
export type TaskStatus = "open" | "done" | "moved" | "failed";

export interface Task {
  id: string;
  person: "dome" | "emely";
  text: string;
  mins: number | null;
  status: TaskStatus;
  icon: string;
  note?: string;
  sub?: string;
}

export interface Appointment {
  id: string;
  time: string;
  title: string;
  place: string;
  who: PersonKey[];
}

export interface ShoppingItem {
  id: string;
  text: string;
  meal: boolean;
  done: boolean;
  /** "frisch" | "haltbar" für Rezept-Items (Korrektur-Toggle sichtbar); null für manuelle. */
  category?: "frisch" | "haltbar" | null;
}

export interface FreshShoppingState {
  /** Offene Frisch-Rezept-Items, die noch nicht auf Bring sind. */
  pendingItems: string[];
  /** Vorschlagstag (ISO) für den Frische-Einkauf, oder null. */
  suggestedDayISO: string | null;
}

export interface Meal {
  day: string;
  dish: string;
  today: boolean;
  light?: boolean;
  /** Shift-aware hint: "emely-allein" | "aufwaermen-extra" | null. */
  reason?: string | null;
  /** True when an extra portion is planned (Dome takes leftovers to work). */
  extraPortion?: boolean;
}

export interface DraftMeal {
  /** ISO-Datum des Tages, für Server-Action-Aufrufe. */
  dateISO: string;
  day: string; // "Mo".."Fr"
  dish: string;
  recipeId: string;
  reason?: string | null;
  extraPortion?: boolean;
}

export interface RecipeOption {
  id: string;
  name: string;
}

export interface Note {
  id: string;
  icon: string;
  text: string;
}

export interface PersonStyle {
  name: string;
  dot: string;
  text: string;
  ring: string;
  soft: string;
  fill: string;
}

export const weather = {
  temp: 18,
  label: "Bewölkt",
  detail: "Regen ab 16 Uhr",
  hi: 19,
  lo: 12,
  rainFrom: "16:00",
  uvIndex: 3,
  wind: 10,
};

export const initialTasks: Task[] = [
  { id: "t1", person: "dome", text: "Müll rausbringen", mins: 5, status: "done", icon: "🗑️" },
  { id: "t2", person: "dome", text: "Abendessen kochen", mins: 30, status: "open", icon: "🍳" },
  { id: "t3", person: "dome", text: "Bad putzen", mins: 25, status: "open", icon: "🛁" },
  {
    id: "t4",
    person: "dome",
    text: "Rasen mähen",
    mins: null,
    status: "moved",
    icon: "🌱",
    note: "Regen → Mi",
    sub: "nur Dome · Outdoor",
  },
  { id: "t5", person: "emely", text: "Wäsche zusammenlegen", mins: 10, status: "open", icon: "🧺" },
];

export const appointments: Appointment[] = [
  { id: "a1", time: "11:00", title: "U4-Untersuchung", place: "Kinderarzt", who: ["emely", "baby"] },
  { id: "a2", time: "18:30", title: "Sport", place: "Verein", who: ["dome"] },
  { id: "a3", time: "20:00", title: "Paket abholen", place: "Packstation", who: [] },
];

export const initialShopping: ShoppingItem[] = [
  { id: "s1", text: "Windeln Gr. 2", meal: false, done: false },
  { id: "s2", text: "Feuchttücher", meal: false, done: false },
  { id: "s3", text: "Milch", meal: false, done: true },
  { id: "s4", text: "Brot", meal: false, done: false },
  { id: "s5", text: "Tomaten", meal: true, done: false },
  { id: "s6", text: "Basilikum", meal: true, done: false },
  { id: "s7", text: "Parmesan", meal: true, done: true },
  { id: "s8", text: "Spülmittel", meal: false, done: false },
];

export const mealPlan: Meal[] = [
  { day: "Mo", dish: "Pasta al Pomodoro", today: true },
  { day: "Di", dish: "Gemüse-Curry", today: false },
  { day: "Mi", dish: "Reste", today: false, light: true },
  { day: "Do", dish: "Ofengemüse", today: false },
  { day: "Fr", dish: "Pizzaabend", today: false },
];

export const notes: Note[] = [
  { id: "n1", icon: "📌", text: "Hebammen-Termin bestätigen" },
  { id: "n2", icon: "🎂", text: "So: Geburtstag Oma" },
  { id: "n3", icon: "🧳", text: "U-Heft einpacken" },
];

export const split = { dome: 72, emely: 28 };

export const PERSON: Record<PersonKey, PersonStyle> = {
  dome: {
    name: "Dome",
    dot: "bg-dome",
    text: "text-dome-deep dark:text-dome",
    ring: "ring-dome/30",
    soft: "bg-dome-soft dark:bg-dome/15",
    fill: "bg-dome",
  },
  emely: {
    name: "Emely",
    dot: "bg-emely",
    text: "text-emely-deep dark:text-emely",
    ring: "ring-emely/30",
    soft: "bg-emely-soft dark:bg-emely/15",
    fill: "bg-emely",
  },
  baby: {
    name: "Baby",
    dot: "bg-ink-faint",
    text: "text-ink-soft",
    ring: "ring-ink-faint/30",
    soft: "bg-black/5 dark:bg-white/10",
    fill: "bg-ink-faint",
  },
};
