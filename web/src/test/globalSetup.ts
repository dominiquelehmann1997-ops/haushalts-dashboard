// Vitest globalSetup: prepares a dedicated SQLite test database (never the
// dev database) by applying the Prisma migrations to it once before the test
// run starts. Runs in a separate process from the test workers.
//
// IMPORTANT: this must never touch `dev.db` — it always points `DATABASE_URL`
// at the dedicated test DB file via an explicit env override on the spawned
// `prisma migrate deploy` process.

import { execFileSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

export const TEST_DB_PATH = path.resolve(__dirname, "../../test.db");
export const TEST_DATABASE_URL = `file:${TEST_DB_PATH.replace(/\\/g, "/")}`;

function removeIfExists(filePath: string) {
  if (existsSync(filePath)) {
    rmSync(filePath, { force: true });
  }
}

export default function globalSetup() {
  const webDir = path.resolve(__dirname, "../..");

  // Start from a clean slate so migrations apply deterministically.
  removeIfExists(TEST_DB_PATH);
  removeIfExists(`${TEST_DB_PATH}-journal`);

  // Invoke the Prisma CLI's JS entrypoint directly via `node` rather than the
  // `npx`/`prisma` shims — avoids Windows EINVAL issues spawning `.cmd` files
  // without a shell, and is more portable across environments.
  const prismaCli = require.resolve("prisma/build/index.js");
  execFileSync(process.execPath, [prismaCli, "migrate", "deploy"], {
    cwd: webDir,
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: TEST_DATABASE_URL,
    },
  });

  return () => {
    removeIfExists(TEST_DB_PATH);
    removeIfExists(`${TEST_DB_PATH}-journal`);
  };
}
