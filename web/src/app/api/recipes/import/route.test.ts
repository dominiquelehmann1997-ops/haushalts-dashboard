// Route-Tests bis zur Validierungsgrenze: Auth und Body-Prüfung. Der Erfolgsfall
// schreibt in die DB und wird deshalb hier nicht angefasst — den deckt der
// End-to-End-Lauf gegen das Tablet ab.

import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { POST } from "./route";

const TOKEN = "test-token-1234567890";
let original: string | undefined;

beforeEach(() => {
  original = process.env.RECIPE_IMPORT_TOKEN;
  process.env.RECIPE_IMPORT_TOKEN = TOKEN;
});

afterEach(() => {
  if (original === undefined) delete process.env.RECIPE_IMPORT_TOKEN;
  else process.env.RECIPE_IMPORT_TOKEN = original;
});

function post(body: unknown, auth?: string, raw?: string): Request {
  return new Request("http://localhost/api/recipes/import", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: raw ?? JSON.stringify(body),
  });
}

const REZEPT = {
  name: "Linsen-Dal",
  ingredients: [{ name: "Rote Linsen", amount: "200", unit: "g" }],
};

describe("POST /api/recipes/import — Authentifizierung", () => {
  it("weist ohne Authorization-Header ab", async () => {
    const res = await POST(post({ recipe: REZEPT }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Nicht autorisiert." });
  });

  it("weist einen falschen Token ab", async () => {
    const res = await POST(post({ recipe: REZEPT }, "Bearer falsch"));
    expect(res.status).toBe(401);
  });

  it("weist einen Token ab, der nur ein Präfix des richtigen ist", async () => {
    const res = await POST(post({ recipe: REZEPT }, `Bearer ${TOKEN.slice(0, -1)}`));
    expect(res.status).toBe(401);
  });

  it("weist einen zu langen Token ab", async () => {
    const res = await POST(post({ recipe: REZEPT }, `Bearer ${TOKEN}x`));
    expect(res.status).toBe(401);
  });

  it("antwortet 503, solange kein Token konfiguriert ist", async () => {
    delete process.env.RECIPE_IMPORT_TOKEN;
    const res = await POST(post({ recipe: REZEPT }, `Bearer ${TOKEN}`));
    expect(res.status).toBe(503);
  });
});

describe("POST /api/recipes/import — Body-Prüfung", () => {
  it("antwortet 400, wenn der Body kein JSON ist", async () => {
    const res = await POST(post(null, `Bearer ${TOKEN}`, "kein json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Body ist kein JSON." });
  });

  it("antwortet 400 ohne Rezept im Body", async () => {
    const res = await POST(post({}, `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Rezept ohne Namen." });
  });

  it("antwortet 400 bei leerem oder fehlendem Namen", async () => {
    const ohneName = await POST(post({ recipe: { ...REZEPT, name: "   " } }, `Bearer ${TOKEN}`));
    expect(ohneName.status).toBe(400);
    await expect(ohneName.json()).resolves.toEqual({ ok: false, error: "Rezept ohne Namen." });
  });

  it("antwortet 400 ohne Zutaten", async () => {
    const leer = await POST(post({ recipe: { ...REZEPT, ingredients: [] } }, `Bearer ${TOKEN}`));
    expect(leer.status).toBe(400);
    await expect(leer.json()).resolves.toEqual({ ok: false, error: "Rezept ohne Zutaten." });

    const fehlt = await POST(post({ recipe: { name: "Linsen-Dal" } }, `Bearer ${TOKEN}`));
    expect(fehlt.status).toBe(400);
    await expect(fehlt.json()).resolves.toEqual({ ok: false, error: "Rezept ohne Zutaten." });
  });
});
