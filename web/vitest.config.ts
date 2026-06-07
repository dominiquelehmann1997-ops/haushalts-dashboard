import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    passWithNoTests: true,
    globalSetup: ["./src/test/globalSetup.ts"],
    // Repository tests share a single SQLite test-DB file and reset it via
    // `seedDatabase` (wipe + recreate) in `beforeEach`. Running test files in
    // parallel would race those resets against each other, so force
    // sequential file execution — fast enough at this scale and keeps the
    // harness simple (one DB file, one source of truth for fixtures).
    fileParallelism: false,
  },
});
