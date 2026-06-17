import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import {
  deleteSubscription,
  getAllSubscriptions,
  upsertSubscription,
} from "./pushSubscriptions";

describe("pushSubscriptions repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  const sub = { personKey: "dome", endpoint: "https://push.example/abc", p256dh: "key1", auth: "auth1" };

  it("inserts a new subscription", async () => {
    await upsertSubscription(sub, client);
    const all = await getAllSubscriptions(client);
    expect(all).toEqual([{ endpoint: sub.endpoint, p256dh: "key1", auth: "auth1", personKey: "dome" }]);
  });

  it("upserts by endpoint — re-subscribing the same device does not duplicate and updates fields", async () => {
    await upsertSubscription(sub, client);
    await upsertSubscription({ ...sub, personKey: "emely", p256dh: "key2", auth: "auth2" }, client);
    const all = await getAllSubscriptions(client);
    expect(all).toHaveLength(1);
    expect(all[0]).toEqual({ endpoint: sub.endpoint, p256dh: "key2", auth: "auth2", personKey: "emely" });
  });

  it("deletes a subscription by endpoint", async () => {
    await upsertSubscription(sub, client);
    await deleteSubscription(sub.endpoint, client);
    expect(await getAllSubscriptions(client)).toEqual([]);
  });
});
