// Repository for pinned/dated notes.

import { prisma } from "@/lib/db";
import { PrismaClient } from "@/generated/prisma/client";
import type { Note } from "@/lib/domain";

/** All notes, pinned first then by id (creation order), mapped to the domain DTO. */
export async function getNotes(client: PrismaClient = prisma): Promise<Note[]> {
  const rows = await client.note.findMany({
    orderBy: [{ pinned: "desc" }, { id: "asc" }],
  });

  return rows.map((row) => ({
    id: row.id,
    icon: row.icon ?? "",
    text: row.text,
    pinned: row.pinned,
  }));
}

export async function createNote(
  input: { text: string; icon?: string | null; pinned?: boolean; date?: Date | null },
  client: PrismaClient = prisma,
): Promise<{ id: string }> {
  const row = await client.note.create({
    data: {
      text: input.text,
      icon: input.icon ?? null,
      pinned: input.pinned ?? false,
      date: input.date ?? null,
    },
    select: { id: true },
  });
  return row;
}

export async function updateNote(
  id: string,
  input: { text?: string; icon?: string | null; pinned?: boolean },
  client: PrismaClient = prisma,
): Promise<void> {
  await client.note.update({ where: { id }, data: input });
}

export async function deleteNote(id: string, client: PrismaClient = prisma): Promise<void> {
  await client.note.delete({ where: { id } });
}

export async function togglePinNote(id: string, client: PrismaClient = prisma): Promise<void> {
  const note = await client.note.findUniqueOrThrow({ where: { id } });
  await client.note.update({ where: { id }, data: { pinned: !note.pinned } });
}
