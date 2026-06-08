// Einmal-Helfer: loggt sich mit BRING_EMAIL/BRING_PASSWORD aus .env bei Bring!
// ein und gibt alle Listen mit ihrer listUuid aus. Die passende UUID dann in
// .env als BRING_LIST_UUID eintragen. Aufruf:  node scripts/bring-list-uuids.mjs
//
// Dieses Skript ist nur ein Setup-Werkzeug, kein Teil der App.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Bring = require("bring-shopping");

// .env minimal parsen (ohne zusätzliche Abhängigkeit).
const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const mail = env.BRING_EMAIL;
const password = env.BRING_PASSWORD;

if (!mail || !password) {
  console.error("✖ BRING_EMAIL / BRING_PASSWORD fehlen in .env");
  process.exit(1);
}

const bring = new Bring({ mail, password });

try {
  await bring.login();
  console.log(`✓ Eingeloggt als: ${bring.name}\n`);

  const { lists } = await bring.loadLists();
  if (!lists.length) {
    console.log("Keine Listen gefunden.");
    process.exit(0);
  }

  console.log("Deine Bring-Listen:\n");
  for (const list of lists) {
    console.log(`  Name:     ${list.name}`);
    console.log(`  listUuid: ${list.listUuid}`);
    console.log("");
  }
  console.log("→ Die passende listUuid in .env als BRING_LIST_UUID eintragen.");
} catch (error) {
  console.error(`✖ Fehler: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
