import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";

export interface PushSubscriptionInput {
  personKey: string;
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
  personKey: string;
}

/** Upsert by endpoint: re-subscribing the same device updates instead of duplicating. */
export async function upsertSubscription(
  input: PushSubscriptionInput,
  client: PrismaClient = prisma,
): Promise<void> {
  const { endpoint, personKey, p256dh, auth } = input;
  await client.pushSubscription.upsert({
    where: { endpoint },
    update: { personKey, p256dh, auth },
    create: { endpoint, personKey, p256dh, auth },
  });
}

export async function deleteSubscription(
  endpoint: string,
  client: PrismaClient = prisma,
): Promise<void> {
  await client.pushSubscription.delete({ where: { endpoint } });
}

export async function getAllSubscriptions(
  client: PrismaClient = prisma,
): Promise<StoredSubscription[]> {
  const rows = await client.pushSubscription.findMany({
    select: { endpoint: true, p256dh: true, auth: true, personKey: true },
    orderBy: { createdAt: "asc" },
  });
  return rows;
}
