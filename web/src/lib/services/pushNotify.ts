import webpush from "web-push";

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import { deleteSubscription, getAllSubscriptions } from "@/lib/repositories/pushSubscriptions";

export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/** True only when all VAPID env vars are present. */
export function isPushConfigured(): boolean {
  return Boolean(
    process.env.VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

let vapidConfigured = false;
function ensureVapid(): void {
  if (vapidConfigured) return;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT!,
    process.env.VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!,
  );
  vapidConfigured = true;
}

/**
 * Sends the payload to every stored subscription. Non-fatal: catches all
 * errors so callers (e.g. draft generation) never fail because of push. Prunes
 * subscriptions the push service reports as gone (HTTP 410/404).
 */
export async function sendToAdults(
  payload: PushPayload,
  client: PrismaClient = prisma,
): Promise<void> {
  if (!isPushConfigured()) return;
  try {
    ensureVapid();

    const subs = await getAllSubscriptions(client);
    const body = JSON.stringify(payload);

    await Promise.all(
      subs.map(async (s) => {
        try {
          await webpush.sendNotification(
            { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
            body,
          );
        } catch (err) {
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 410 || status === 404) {
            await deleteSubscription(s.endpoint, client).catch(() => {});
          }
        }
      }),
    );
  } catch {
    // non-fatal: DB or push-infrastructure failure must not crash the caller
  }
}
