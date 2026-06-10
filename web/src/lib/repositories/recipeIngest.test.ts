import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import { ingestVault } from "./recipeIngest";

function writeVault(files: Record<string, string>): string {
  const dir = mkdtempSync(path.join(tmpdir(), "vault-"));
  for (const [name, content] of Object.entries(files)) {
    writeFileSync(path.join(dir, name), content);
  }
  return dir;
}

const CURRY = `---
id: kokos-curry
name: Kokos-Curry
rating: favorit
simple: false
reheatable: true
ingredients:
  - { name: Kokosmilch, amount: 400, unit: ml, freshness: haltbar }
  - { name: Spinat, freshness: frisch }
---
## Zubereitung
1. Kochen.
`;

const SUPPE = `---
name: Möhrensuppe
---
`;

describe("ingestVault", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("upserts vault recipes by slug with ingredients and rating", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY, "Möhrensuppe.md": SUPPE, "_template.md": SUPPE });
    try {
      const report = await ingestVault(dir, client);
      expect(report.imported).toBe(2); // _template.md skipped
      expect(report.errors).toEqual([]);

      const curry = await client.recipe.findUnique({
        where: { slug: "kokos-curry" },
        include: { ingredients: true },
      });
      expect(curry?.name).toBe("Kokos-Curry");
      expect(curry?.rating).toBe("favorit");
      expect(curry?.reheatable).toBe(true);
      expect(curry?.archived).toBe(false);
      expect(curry?.ingredients.map((i) => [i.name, i.category]).sort()).toEqual([
        ["Kokosmilch", "haltbar"],
        ["Spinat", "frisch"],
      ]);

      // slug fallback from filename when frontmatter has no id
      const suppe = await client.recipe.findUnique({ where: { slug: "m-hrensuppe" } });
      expect(suppe?.name).toBe("Möhrensuppe");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("re-ingests idempotently and replaces ingredients", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY });
    try {
      await ingestVault(dir, client);
      const report = await ingestVault(dir, client); // second run
      expect(report.imported).toBe(1);
      const curry = await client.recipe.findUnique({
        where: { slug: "kokos-curry" },
        include: { ingredients: true },
      });
      expect(curry?.ingredients.length).toBe(2); // not duplicated
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("archives vault recipes that disappear from the vault, leaves seed recipes alone", async () => {
    const dir = writeVault({ "kokos-curry.md": CURRY, "Möhrensuppe.md": SUPPE });
    try {
      await ingestVault(dir, client);
      // Remove one file by re-pointing at a vault that no longer has it.
      const dir2 = writeVault({ "kokos-curry.md": CURRY });
      try {
        const report = await ingestVault(dir2, client);
        expect(report.archived).toBe(1);
        const suppe = await client.recipe.findUnique({ where: { slug: "m-hrensuppe" } });
        expect(suppe?.archived).toBe(true);
        // A seed recipe (slug null) is never archived.
        const seed = await client.recipe.findFirst({ where: { slug: null } });
        expect(seed?.archived).toBe(false);
      } finally {
        rmSync(dir2, { recursive: true, force: true });
      }
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("reports an error and imports nothing for a missing vault path", async () => {
    const report = await ingestVault(path.join(tmpdir(), "does-not-exist-xyz"), client);
    expect(report.imported).toBe(0);
    expect(report.errors.length).toBeGreaterThan(0);
  });

  it("records a per-file error for a recipe without a name", async () => {
    const dir = writeVault({ "broken.md": `---\nrating: ok\n---\n` });
    try {
      const report = await ingestVault(dir, client);
      expect(report.imported).toBe(0);
      expect(report.errors.some((e) => /broken\.md/.test(e))).toBe(true);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
