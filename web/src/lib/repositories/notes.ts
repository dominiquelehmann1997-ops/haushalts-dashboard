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
  }));
}
