// Test-DB harness reused by all repository tests (and by Phases 2 & 3).
//
// Each test file gets its own PrismaClient instance pointed at the dedicated
// SQLite test database (never `dev.db` — see `globalSetup.ts`, which applies
// the migrations once before the run). `resetDatabase` re-runs the shared
// `seedDatabase` fixture (it wipes + recreates), giving each test a known,
// isolated starting state without duplicating fixture data.

import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

import { seedDatabase } from "../../prisma/seed";
import { PrismaClient } from "../generated/prisma/client";

import { TEST_DATABASE_URL } from "./globalSetup";

/** Creates a fresh PrismaClient connected to the dedicated test database. */
export function createTestClient(): PrismaClient {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DATABASE_URL });
  return new PrismaClient({ adapter });
}

/**
 * Wipes and re-seeds the test database with the shared fixture data via
 * `seedDatabase`. Call in `beforeEach`/`beforeAll` for deterministic,
 * isolated test data — single source of truth, no duplicated fixtures.
 */
export async function resetDatabase(client: PrismaClient): Promise<void> {
  await seedDatabase(client);
}
