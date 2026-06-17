import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";
import { upsertSubscription, getAllSubscriptions } from "@/lib/repositories/pushSubscriptions";

const sendNotification = vi.fn();
const setVapidDetails = vi.fn();
vi.mock("web-push", () => ({
  default: {
    sendNotification: (...args: unknown[]) => sendNotification(...args),
    setVapidDetails: (...args: unknown[]) => setVapidDetails(...args),
  },
}));

import { isPushConfigured, sendToAdults } from "./pushNotify";

describe("pushNotify", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
    sendNotification.mockReset();
    setVapidDetails.mockReset();
    sendNotification.mockResolvedValue({ statusCode: 201 });
    process.env.VAPID_PUBLIC_KEY = "pub";
    process.env.VAPID_PRIVATE_KEY = "priv";
    process.env.VAPID_SUBJECT = "mailto:test@example.org";
  });

  afterEach(() => {
    delete process.env.VAPID_PUBLIC_KEY;
    delete process.env.VAPID_PRIVATE_KEY;
    delete process.env.VAPID_SUBJECT;
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  const payload = { title: "T", body: "B", url: "/" };

  it("is configured only when all VAPID vars are present", () => {
    expect(isPushConfigured()).toBe(true);
    delete process.env.VAPID_PRIVATE_KEY;
    expect(isPushConfigured()).toBe(false);
  });

  it("sends the JSON payload to every stored subscription", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/1", p256dh: "k1", auth: "a1" }, client);
    await upsertSubscription({ personKey: "emely", endpoint: "https://e/2", p256dh: "k2", auth: "a2" }, client);

    await sendToAdults(payload, client);

    expect(sendNotification).toHaveBeenCalledTimes(2);
    const [subArg, bodyArg] = sendNotification.mock.calls[0];
    expect(subArg).toEqual({ endpoint: "https://e/1", keys: { p256dh: "k1", auth: "a1" } });
    expect(JSON.parse(bodyArg as string)).toEqual(payload);
  });

  it("deletes a subscription when the push service returns 410", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/gone", p256dh: "k", auth: "a" }, client);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("gone"), { statusCode: 410 }));

    await sendToAdults(payload, client);

    expect(await getAllSubscriptions(client)).toEqual([]);
  });

  it("never throws when a send fails for a non-expiry reason and keeps the subscription", async () => {
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/keep", p256dh: "k", auth: "a" }, client);
    sendNotification.mockRejectedValueOnce(Object.assign(new Error("boom"), { statusCode: 500 }));

    await expect(sendToAdults(payload, client)).resolves.toBeUndefined();
    expect(await getAllSubscriptions(client)).toHaveLength(1);
  });

  it("never throws when the subscription DB lookup fails (non-fatal outer guard)", async () => {
    const brokenClient = {
      pushSubscription: { findMany: vi.fn().mockRejectedValue(new Error("db down")) },
    } as unknown as PrismaClient;

    await expect(sendToAdults(payload, brokenClient)).resolves.toBeUndefined();
  });

  it("is a no-op (no sends) when VAPID is not configured", async () => {
    delete process.env.VAPID_PUBLIC_KEY;
    await upsertSubscription({ personKey: "dome", endpoint: "https://e/x", p256dh: "k", auth: "a" }, client);

    await sendToAdults(payload, client);

    expect(sendNotification).not.toHaveBeenCalled();
  });
});
