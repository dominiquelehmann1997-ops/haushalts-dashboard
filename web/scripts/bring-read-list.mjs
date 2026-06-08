// Einmal-Helfer: liest die Artikel der in .env konfigurierten BRING_LIST_UUID
// und gibt sie aus — zum Verifizieren, ob der Push angekommen ist.
// Aufruf:  node scripts/bring-read-list.mjs

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const Bring = require("bring-shopping");

const envPath = join(dirname(fileURLToPath(import.meta.url)), "..", ".env");
const env = {};
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}

const bring = new Bring({ mail: env.BRING_EMAIL, password: env.BRING_PASSWORD });

try {
  await bring.login();
  const items = await bring.getItems(env.BRING_LIST_UUID);
  console.log(`Liste ${env.BRING_LIST_UUID} — ${items.purchase.length} offene Artikel:`);
  for (const item of items.purchase) {
    console.log(`  • ${item.name}${item.specification ? " (" + item.specification + ")" : ""}`);
  }
} catch (error) {
  console.error(`✖ Fehler: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
}
