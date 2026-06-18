import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { getNotes, createNote, updateNote, deleteNote, togglePinNote } from "./notes";

describe("notes repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("getNotes returns pinned notes first, mapped to the domain DTO", async () => {
    const notes = await getNotes(client);

    expect(notes).toHaveLength(3);
    expect(notes[0]).toMatchObject({ icon: "📌", text: "Hebammen-Termin bestätigen" });
  });

  describe("notes CRUD", () => {
    it("creates, updates, pins and deletes a note", async () => {
      const { id } = await createNote({ text: "Kita anrufen", icon: "📞" }, client);
      let note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.text).toBe("Kita anrufen");
      expect(note.pinned).toBe(false);

      await updateNote(id, { text: "Kita morgen anrufen" }, client);
      note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.text).toBe("Kita morgen anrufen");

      await togglePinNote(id, client);
      note = await client.note.findUniqueOrThrow({ where: { id } });
      expect(note.pinned).toBe(true);

      await deleteNote(id, client);
      expect(await client.note.findUnique({ where: { id } })).toBeNull();
    });

    it("getNotes exposes the pinned flag, pinned first", async () => {
      await createNote({ text: "A", pinned: false }, client);
      await createNote({ text: "B", pinned: true }, client);
      const notes = await getNotes(client);
      expect(notes[0]?.pinned).toBe(true);
      expect(notes.every((n) => typeof n.pinned === "boolean")).toBe(true);
    });
  });
});
