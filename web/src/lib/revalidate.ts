// web/src/lib/revalidate.ts
import { revalidatePath } from "next/cache";

const DASHBOARD_PATHS = [
  "/",
  "/mobile",
  "/mobile/tasks",
  "/mobile/meals",
  "/mobile/shopping",
  "/mobile/more",
] as const;

/**
 * Revalidates the tablet root and all mobile routes. Both surfaces share the
 * same data, so any mutation should refresh both. Cheap; runs server-side.
 */
export function revalidateDashboard(): void {
  for (const path of DASHBOARD_PATHS) revalidatePath(path);
}
