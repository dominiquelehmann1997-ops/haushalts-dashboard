"use server";

// Server Actions für die Web-Push-Geräteanmeldung (Roadmap C2). Dünne Wrapper
// über das pushSubscriptions-Repository; die Upsert-by-endpoint-Logik ist dort
// getestet.

import { Prisma } from "@/generated/prisma/client";
import { deleteSubscription, upsertSubscription } from "@/lib/repositories/pushSubscriptions";

export interface WebPushSubscriptionJSON {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

/** Registers (or refreshes) this device's push subscription for a person. */
export async function subscribePushAction(
  personKey: string,
  sub: WebPushSubscriptionJSON,
): Promise<void> {
  await upsertSubscription({
    personKey,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
  });
}

/** Removes this device's subscription. Tolerates a missing record (P2025). */
export async function unsubscribePushAction(endpoint: string): Promise<void> {
  try {
    await deleteSubscription(endpoint);
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      // Record already gone — treat as a successful unsubscribe.
      return;
    }
    throw err;
  }
}
