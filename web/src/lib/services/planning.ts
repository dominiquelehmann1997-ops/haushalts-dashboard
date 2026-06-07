// Planning service — connects the pure fairness/distribution engine (Phase 2)
// to the DB (Phase 1/3a): plans the unassigned, open, standalone tasks due on
// a given day, applying the engine's decisions to the database.
//
// Manual assignments are respected: only tasks that are still `open`,
// `assignedToId == null` and standalone (`projectId == null`) are considered.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { dayBounds } from "@/lib/dates";
import { planTask } from "@/lib/engine";
import type { Balances, EngineTask, PersonKey, PhaseConfig, PlanInput, PlanResult } from "@/lib/engine/types";
import { getActivePhase } from "@/lib/repositories/phase";
import { getWeeklyBalances } from "@/lib/repositories/accounts";
import { assignTask } from "@/lib/repositories/tasks";

export interface PlanDecision {
  taskId: string;
  result: PlanResult;
}

const DEFAULT_PHASE: PhaseConfig = {
  mode: "normal",
  target: { dome: 50, emely: 50 },
};

/** Parses a `Task.weatherCondition` JSON string into the engine's shape, or `undefined`. */
function parseWeatherCondition(raw: string | null): EngineTask["weatherCondition"] {
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as EngineTask["weatherCondition"];
  } catch {
    return undefined;
  }
}

function toEngineTask(row: {
  id: string;
  allowedPersons: string;
  outdoor: boolean;
  weatherCondition: string | null;
  effort: number;
}): EngineTask {
  return {
    id: row.id,
    allowedPersons: row.allowedPersons as EngineTask["allowedPersons"],
    outdoor: row.outdoor,
    weatherCondition: parseWeatherCondition(row.weatherCondition),
    effort: row.effort,
  };
}

async function loadPhaseConfig(client: PrismaClient): Promise<PhaseConfig> {
  const phase = await getActivePhase(client);
  if (!phase) return DEFAULT_PHASE;

  const caregiver =
    phase.caregiverKey === "dome" || phase.caregiverKey === "emely" ? phase.caregiverKey : undefined;

  return {
    mode: phase.mode as PhaseConfig["mode"],
    target: { dome: phase.targetDome, emely: phase.targetEmely },
    caregiver,
  };
}

/**
 * Plans the unassigned, open, standalone tasks due on `day`:
 * loads the active phase + weekly balances, runs each due task through the
 * pure engine's `planTask`, and applies the decision to the DB —
 * `assigned` bookings update the local balances incrementally so fairness
 * spreads work across the batch, `deferred` tasks are rescheduled, and
 * `unassignable` tasks are left untouched (still open, unassigned).
 */
export async function planDueTasks(day: Date, client: PrismaClient = prisma): Promise<PlanDecision[]> {
  const { start, end } = dayBounds(day);

  const phase = await loadPhaseConfig(client);
  const balances: Balances = await getWeeklyBalances(client);

  const dueTasks = await client.task.findMany({
    where: {
      projectId: null,
      status: "open",
      assignedToId: null,
      dueDate: { gte: start, lte: end },
    },
    orderBy: [{ dueDate: "asc" }, { id: "asc" }],
  });

  const decisions: PlanDecision[] = [];

  for (const row of dueTasks) {
    const task = toEngineTask(row);

    const input: PlanInput = {
      task,
      day,
      window: undefined,
      persons: ["dome", "emely"],
      busy: [],
      forecast: [],
      phase,
      balances,
    };

    const result = planTask(input);

    if (result.kind === "assigned") {
      await assignTask(task.id, result.person, result.day, client);
      balances[result.person as PersonKey] += task.effort;
    } else if (result.kind === "deferred") {
      await client.task.update({
        where: { id: task.id },
        data: {
          status: "moved",
          note: result.reason,
          dueDate: result.suggestedDay,
        },
      });
    }
    // "unassignable" → leave the task untouched (still open, unassigned).

    decisions.push({ taskId: task.id, result });
  }

  return decisions;
}
