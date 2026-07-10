import { describe, expect, it } from "vitest";

import { obsidianUrl } from "./obsidian";

describe("obsidianUrl", () => {
  it("baut einen obsidian://open-Link aus Vault-Name und Datei", () => {
    expect(obsidianUrl("Rezepte/Kokos-Curry", "Haushalt")).toBe(
      "obsidian://open?vault=Haushalt&file=Rezepte%2FKokos-Curry",
    );
  });

  it("kodiert Leerzeichen und Sonderzeichen im Vault-Namen und Dateipfad", () => {
    expect(obsidianUrl("Rezepte/Möhrensuppe", "Familie Müller")).toBe(
      "obsidian://open?vault=Familie%20M%C3%BCller&file=Rezepte%2FM%C3%B6hrensuppe",
    );
  });

  it("gibt null zurück ohne vaultFile", () => {
    expect(obsidianUrl(null, "Haushalt")).toBeNull();
    expect(obsidianUrl(undefined, "Haushalt")).toBeNull();
  });

  it("gibt null zurück ohne vaultName", () => {
    expect(obsidianUrl("Rezepte/Kokos-Curry", undefined)).toBeNull();
  });
});
