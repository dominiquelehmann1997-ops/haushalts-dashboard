"use server";

// Server Actions für die Routinen-Verwaltung (Handy). Dünne Wrapper um das
// Tasks-Repository — mutieren und danach das Dashboard revalidieren, damit
// geänderte Routinen sofort in allen Ansichten greifen. Die Fachlogik
// (Validierung, kettenweites Schreiben, Umplanen) liegt im Repository.

import { revalidateDashboard } from "@/lib/revalidate";
import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  updateRoutineTemplate,
  type AllowedPersons,
} from "@/lib/repositories/tasks";

/** Was die UI je Routine schickt — Wetter zerlegt in die beiden Bedienelemente. */
export interface RoutineFieldsInput {
  title: string;
  icon: string;
  effort: number;
  rhythm: string | null;
  allowedPersons: AllowedPersons;
  outdoor: boolean;
  /** Nur bei Regen nicht einplanen. */
  noRain: boolean;
  /** Mindest-Tageshöchsttemperatur in °C, oder `null` für egal. */
  minTemp: number | null;
}

/**
 * Baut aus den beiden Wetter-Bedienelementen den JSON-String, den die Engine
 * liest (`@/lib/engine/weatherCheck`). Ohne `outdoor` bleibt er leer — das
 * Wetter wird für Indoor-Aufgaben ohnehin nicht geprüft.
 */
function toWeatherCondition(input: RoutineFieldsInput): string | null {
  if (!input.outdoor) return null;

  const condition: { noRain?: boolean; minTemp?: number } = {};
  if (input.noRain) condition.noRain = true;
  if (input.minTemp !== null) condition.minTemp = input.minTemp;

  return Object.keys(condition).length > 0 ? JSON.stringify(condition) : null;
}

/**
 * Ändert eine Routine dauerhaft — auf allen Zeilen ihrer Kette. Ein geänderter
 * Rhythmus verschiebt zusätzlich den bereits geplanten Termin.
 */
export async function updateRoutineAction(
  input: RoutineFieldsInput & { chainId: string },
): Promise<void> {
  await updateRoutineTemplate(input.chainId, {
    title: input.title,
    icon: input.icon,
    effort: input.effort,
    rhythm: input.rhythm,
    allowedPersons: input.allowedPersons,
    outdoor: input.outdoor,
    weatherCondition: toWeatherCondition(input),
  });
  revalidateDashboard();
}

/** Legt eine neue Routine an, fällig ab heute. */
export async function createRoutineAction(
  input: RoutineFieldsInput & { rhythm: string },
): Promise<void> {
  await createRoutineTemplate({
    title: input.title,
    icon: input.icon,
    effort: input.effort,
    rhythm: input.rhythm,
    allowedPersons: input.allowedPersons,
    outdoor: input.outdoor,
    weatherCondition: toWeatherCondition(input),
  });
  revalidateDashboard();
}

/** Beendet eine Routine; erledigte Occurrences bleiben als Historie erhalten. */
export async function deleteRoutineAction(chainId: string): Promise<void> {
  await deleteRoutineTemplate(chainId);
  revalidateDashboard();
}
