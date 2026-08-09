import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import {
  createRoutineTemplate,
  deleteRoutineTemplate,
  listRoutineTemplates,
  updateRoutineTemplate,
} from "./tasks";

const DAY_MS = 86_400_000;

function todayMidnight(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

describe("Routine-Vorlagen (Routinen-Verwaltung)", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Kette mit einer offenen Zeile — der Normalfall einer lebenden Routine. */
  async function makeChain(
    title: string,
    overrides: Record<string, unknown> = {},
  ): Promise<{ id: string }> {
    return client.task.create({
      data: {
        title,
        type: "routine",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both",
        status: "open",
        dueDate: new Date("2026-07-01"),
        ...overrides,
      },
      select: { id: true },
    });
  }

  describe("listRoutineTemplates", () => {
    it("fasst eine Occurrence-Kette zu genau einer Vorlage zusammen (jüngste Zeile ist Repräsentant)", async () => {
      const parent = await makeChain("Testkette putzen", { status: "done" });
      // Neuere Occurrence derselben Kette mit abweichenden Werten.
      await client.task.create({
        data: {
          title: "Testkette putzen",
          type: "routine",
          effort: 25,
          rhythm: "biweekly",
          allowedPersons: "dome",
          status: "open",
          dueDate: new Date("2026-07-08"),
          recurringParentId: parent.id,
        },
      });

      const templates = await listRoutineTemplates(client);
      const mine = templates.filter((t) => t.title === "Testkette putzen");

      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({
        chainId: parent.id,
        effort: 25, // Werte der jüngsten Zeile
        rhythm: "biweekly",
        allowedPersons: "dome",
      });
    });

    it("liefert den nächsten offenen Termin als nextDueISO", async () => {
      const parent = await makeChain("Termin sichtbar", { status: "done" });
      await client.task.create({
        data: {
          title: "Termin sichtbar",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "open",
          dueDate: new Date("2026-07-09"),
          recurringParentId: parent.id,
        },
      });

      const found = (await listRoutineTemplates(client)).find((t) => t.title === "Termin sichtbar");

      expect(found?.nextDueISO).toBe(new Date("2026-07-09").toISOString());
    });

    it("nimmt auch eine verschobene Zeile als nächsten Termin", async () => {
      await makeChain("Nur verschoben", { status: "moved", dueDate: new Date("2026-07-20") });

      const found = (await listRoutineTemplates(client)).find((t) => t.title === "Nur verschoben");

      expect(found?.nextDueISO).toBe(new Date("2026-07-20").toISOString());
    });

    it("blendet beendete Ketten aus (keine offene oder verschobene Zeile mehr)", async () => {
      await makeChain("Nur Historie", { status: "done" });

      const titles = (await listRoutineTemplates(client)).map((t) => t.title);

      expect(titles).not.toContain("Nur Historie");
    });

    it("reicht outdoor und Wetterbedingung durch", async () => {
      await makeChain("Draußen werkeln", {
        outdoor: true,
        weatherCondition: '{"noRain":true}',
      });

      const found = (await listRoutineTemplates(client)).find((t) => t.title === "Draußen werkeln");

      expect(found?.outdoor).toBe(true);
      expect(found?.weatherCondition).toBe('{"noRain":true}');
    });
  });

  describe("updateRoutineTemplate", () => {
    it("schreibt Dauer/Rhythmus/Zuständigkeit auf ALLE Zeilen der Kette", async () => {
      const parent = await makeChain("Kette update");
      const child = await client.task.create({
        data: {
          title: "Kette update",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          dueDate: new Date("2026-07-08"),
          recurringParentId: parent.id,
        },
      });

      await updateRoutineTemplate(
        parent.id,
        { effort: 45, rhythm: "monthly", allowedPersons: "emely" },
        client,
      );

      const rows = await client.task.findMany({
        where: { OR: [{ id: parent.id }, { recurringParentId: parent.id }] },
      });
      expect(rows).toHaveLength(2);
      for (const r of rows) {
        expect(r.effort).toBe(45);
        expect(r.rhythm).toBe("monthly");
        expect(r.allowedPersons).toBe("emely");
      }
      // Sicherstellen, dass wirklich beide (parent + child) getroffen wurden.
      expect(rows.map((r) => r.id).sort()).toEqual([parent.id, child.id].sort());
    });

    it("ändert auch Titel und Symbol kettenweit", async () => {
      const parent = await makeChain("Alter Titel", { icon: "🧹" });
      await client.task.create({
        data: {
          title: "Alter Titel",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          icon: "🧹",
          dueDate: new Date("2026-07-08"),
          recurringParentId: parent.id,
        },
      });

      await updateRoutineTemplate(parent.id, { title: "Neuer Titel", icon: "✨" }, client);

      const rows = await client.task.findMany({
        where: { OR: [{ id: parent.id }, { recurringParentId: parent.id }] },
      });
      for (const r of rows) {
        expect(r.title).toBe("Neuer Titel");
        expect(r.icon).toBe("✨");
      }
    });

    it("lässt nicht übergebene Felder unangetastet (Patch-Semantik)", async () => {
      const parent = await makeChain("Nur Dauer", { effort: 10, allowedPersons: "dome" });

      await updateRoutineTemplate(parent.id, { effort: 30 }, client);

      const row = await client.task.findUniqueOrThrow({ where: { id: parent.id } });
      expect(row.effort).toBe(30);
      expect(row.rhythm).toBe("weekly");
      expect(row.allowedPersons).toBe("dome");
    });

    it("leert die Wetterbedingung, wenn outdoor abgeschaltet wird", async () => {
      const parent = await makeChain("Wetter weg", {
        outdoor: true,
        weatherCondition: '{"noRain":true}',
      });

      await updateRoutineTemplate(
        parent.id,
        { outdoor: false, weatherCondition: '{"noRain":true}' },
        client,
      );

      const row = await client.task.findUniqueOrThrow({ where: { id: parent.id } });
      expect(row.outdoor).toBe(false);
      expect(row.weatherCondition).toBeNull();
    });

    it("akzeptiert ein freies Intervall und weist zu große Werte ab", async () => {
      const parent = await makeChain("Freies Intervall");

      await updateRoutineTemplate(parent.id, { rhythm: "10-day" }, client);
      const row = await client.task.findUniqueOrThrow({ where: { id: parent.id } });
      expect(row.rhythm).toBe("10-day");

      await expect(updateRoutineTemplate(parent.id, { rhythm: "400-day" }, client)).rejects.toThrow();
    });

    it("weist ungültige Eingaben ab (Rhythmus, Dauer, Zuständigkeit, Titel)", async () => {
      const parent = await makeChain("Kette validierung");

      await expect(updateRoutineTemplate(parent.id, { effort: -5 }, client)).rejects.toThrow();
      await expect(updateRoutineTemplate(parent.id, { rhythm: "nonsense" }, client)).rejects.toThrow();
      await expect(updateRoutineTemplate(parent.id, { title: "   " }, client)).rejects.toThrow();
      await expect(
        // @ts-expect-error absichtlich ungültiger Wert
        updateRoutineTemplate(parent.id, { allowedPersons: "niemand" }, client),
      ).rejects.toThrow();
    });

    it("wirft für eine unbekannte Kette", async () => {
      await expect(updateRoutineTemplate("gibt-es-nicht", { effort: 10 }, client)).rejects.toThrow();
    });

    describe("Rhythmuswechsel plant den offenen Termin sofort um", () => {
      it("rechnet ab der letzten Erledigung", async () => {
        const done = new Date();
        done.setDate(done.getDate() - 1);
        done.setHours(0, 0, 0, 0);

        const parent = await client.task.create({
          data: {
            title: "Umplanen",
            type: "routine",
            effort: 10,
            rhythm: "weekly",
            allowedPersons: "both",
            status: "done",
            completedAt: done,
            dueDate: done,
          },
        });
        const open = await client.task.create({
          data: {
            title: "Umplanen",
            type: "routine",
            effort: 10,
            rhythm: "weekly",
            allowedPersons: "both",
            status: "open",
            dueDate: new Date(done.getTime() + 7 * DAY_MS),
            recurringParentId: parent.id,
          },
        });

        await updateRoutineTemplate(parent.id, { rhythm: "3-day" }, client);

        const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
        expect(row.dueDate.getTime()).toBe(done.getTime() + 3 * DAY_MS);
      });

      it("zieht höchstens auf heute vor, nie in die Vergangenheit", async () => {
        const longAgo = new Date();
        longAgo.setDate(longAgo.getDate() - 40);
        longAgo.setHours(0, 0, 0, 0);

        const parent = await client.task.create({
          data: {
            title: "Lange her",
            type: "routine",
            effort: 10,
            rhythm: "monthly",
            allowedPersons: "both",
            status: "done",
            completedAt: longAgo,
            dueDate: longAgo,
          },
        });
        const open = await client.task.create({
          data: {
            title: "Lange her",
            type: "routine",
            effort: 10,
            rhythm: "monthly",
            allowedPersons: "both",
            status: "open",
            dueDate: new Date(),
            recurringParentId: parent.id,
          },
        });

        await updateRoutineTemplate(parent.id, { rhythm: "daily" }, client);

        const row = await client.task.findUniqueOrThrow({ where: { id: open.id } });
        expect(row.dueDate.getTime()).toBe(todayMidnight().getTime());
      });

      it("rührt den Termin nicht an, wenn der Rhythmus gleich bleibt", async () => {
        const due = new Date("2026-07-15");
        const parent = await makeChain("Gleicher Rhythmus", { dueDate: due });

        await updateRoutineTemplate(parent.id, { effort: 20, rhythm: "weekly" }, client);

        const row = await client.task.findUniqueOrThrow({ where: { id: parent.id } });
        expect(row.dueDate.getTime()).toBe(due.getTime());
      });
    });
  });

  describe("createRoutineTemplate", () => {
    it("legt eine offene, unzugewiesene Routine an, die heute fällig ist", async () => {
      const { id } = await createRoutineTemplate(
        {
          title: "Neue Routine",
          icon: "🧽",
          effort: 20,
          rhythm: "5-day",
          allowedPersons: "dome",
          outdoor: false,
          weatherCondition: null,
        },
        client,
      );

      const row = await client.task.findUniqueOrThrow({ where: { id } });
      expect(row.type).toBe("routine");
      expect(row.status).toBe("open");
      expect(row.assignedToId).toBeNull();
      expect(row.recurringParentId).toBeNull();
      expect(row.rhythm).toBe("5-day");
      expect(row.effort).toBe(20);
      expect(row.allowedPersons).toBe("dome");
      expect(row.dueDate.getTime()).toBe(todayMidnight().getTime());
    });

    it("taucht sofort als Vorlage auf", async () => {
      await createRoutineTemplate(
        {
          title: "Frisch angelegt",
          icon: "",
          effort: 5,
          rhythm: "weekly",
          allowedPersons: "both",
          outdoor: false,
          weatherCondition: null,
        },
        client,
      );

      const titles = (await listRoutineTemplates(client)).map((t) => t.title);
      expect(titles).toContain("Frisch angelegt");
    });

    it("weist ungültige Eingaben ab", async () => {
      const base = {
        title: "Ungültig",
        icon: "",
        effort: 10,
        rhythm: "weekly",
        allowedPersons: "both" as const,
        outdoor: false,
        weatherCondition: null,
      };

      await expect(createRoutineTemplate({ ...base, title: "  " }, client)).rejects.toThrow();
      await expect(createRoutineTemplate({ ...base, rhythm: "nonsense" }, client)).rejects.toThrow();
      await expect(createRoutineTemplate({ ...base, effort: 5000 }, client)).rejects.toThrow();
    });
  });

  describe("deleteRoutineTemplate", () => {
    it("entfernt offene und verschobene Zeilen, behält die Historie", async () => {
      const parent = await client.task.create({
        data: {
          title: "Zu beenden",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "done",
          completedAt: new Date("2026-07-01"),
          dueDate: new Date("2026-07-01"),
        },
      });
      const open = await client.task.create({
        data: {
          title: "Zu beenden",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "open",
          dueDate: new Date("2026-07-08"),
          recurringParentId: parent.id,
        },
      });
      const moved = await client.task.create({
        data: {
          title: "Zu beenden",
          type: "routine",
          effort: 10,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "moved",
          dueDate: new Date("2026-07-10"),
          recurringParentId: parent.id,
        },
      });

      const result = await deleteRoutineTemplate(parent.id, client);

      expect(result.deleted).toBe(2);
      expect(await client.task.findUnique({ where: { id: open.id } })).toBeNull();
      expect(await client.task.findUnique({ where: { id: moved.id } })).toBeNull();
      expect(await client.task.findUnique({ where: { id: parent.id } })).not.toBeNull();
    });

    it("lässt die Fairness-Buchung der erledigten Zeile unangetastet", async () => {
      const dome = await client.person.findFirstOrThrow({ where: { key: "dome" } });
      const parent = await client.task.create({
        data: {
          title: "Mit Buchung",
          type: "routine",
          effort: 15,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "done",
          completedAt: new Date("2026-07-01"),
          dueDate: new Date("2026-07-01"),
          assignedToId: dome.id,
        },
      });
      const entry = await client.accountEntry.create({
        data: {
          personId: dome.id,
          taskId: parent.id,
          points: 15,
          source: "planned",
          label: "Mit Buchung",
        },
      });
      await client.task.create({
        data: {
          title: "Mit Buchung",
          type: "routine",
          effort: 15,
          rhythm: "weekly",
          allowedPersons: "both",
          status: "open",
          dueDate: new Date("2026-07-08"),
          recurringParentId: parent.id,
        },
      });

      await deleteRoutineTemplate(parent.id, client);

      expect(await client.accountEntry.findUnique({ where: { id: entry.id } })).not.toBeNull();
    });

    it("verschwindet danach aus der Vorlagenliste", async () => {
      const parent = await makeChain("Weg damit");

      await deleteRoutineTemplate(parent.id, client);

      const titles = (await listRoutineTemplates(client)).map((t) => t.title);
      expect(titles).not.toContain("Weg damit");
    });

    it("ist gefahrlos wiederholbar", async () => {
      const parent = await makeChain("Doppelt beenden");

      expect((await deleteRoutineTemplate(parent.id, client)).deleted).toBe(1);
      expect((await deleteRoutineTemplate(parent.id, client)).deleted).toBe(0);
    });
  });
});
