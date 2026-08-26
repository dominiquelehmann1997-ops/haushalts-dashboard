import { afterEach, describe, expect, it } from "vitest";

import { checkImportToken } from "./importAuth";

const req = (auth?: string) =>
  new Request("http://localhost/api/recipes/parse", {
    method: "POST",
    headers: auth ? { authorization: auth } : {},
  });

afterEach(() => {
  delete process.env.RECIPE_IMPORT_TOKEN;
});

describe("checkImportToken", () => {
  it("lehnt ab, solange kein Token konfiguriert ist", () => {
    expect(checkImportToken(req("Bearer egal"))).toEqual({
      ok: false,
      status: 503,
      error: "Import-Endpunkt nicht konfiguriert (RECIPE_IMPORT_TOKEN fehlt).",
    });
  });

  it("lässt den passenden Token durch", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("Bearer geheim"))).toEqual({ ok: true });
  });

  it("lehnt falschen, fehlenden und formlosen Token ab", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("Bearer falsch")).ok).toBe(false);
    expect(checkImportToken(req()).ok).toBe(false);
    expect(checkImportToken(req("geheim")).ok).toBe(false);
    expect(checkImportToken(req("Bearer falsch"))).toEqual({
      ok: false,
      status: 401,
      error: "Nicht autorisiert.",
    });
  });

  // timingSafeEqual wirft bei ungleicher Länge — ohne die explizite Längenprüfung
  // wäre das ein 500er statt eines 401ers.
  it("lehnt zu kurze und zu lange Token ab, ohne zu werfen", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("Bearer gehei")).ok).toBe(false);
    expect(checkImportToken(req("Bearer geheimer")).ok).toBe(false);
    expect(checkImportToken(req("Bearer ")).ok).toBe(false);
  });

  it("akzeptiert das Schema unabhängig von der Schreibweise", () => {
    process.env.RECIPE_IMPORT_TOKEN = "geheim";
    expect(checkImportToken(req("bearer geheim"))).toEqual({ ok: true });
    expect(checkImportToken(req("BEARER geheim"))).toEqual({ ok: true });
  });
});
