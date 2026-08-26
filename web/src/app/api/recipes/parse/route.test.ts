// Route-Tests bis zur Validierungsgrenze: Auth und Body-Prüfung. Der Erfolgsfall
// ruft die Extraktion (Abo-Kontingent) bzw. eine fremde Seite auf und wird
// deshalb hier nicht angefasst — den deckt der End-to-End-Lauf gegen das Tablet ab.

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
  return new Request("http://localhost/api/recipes/parse", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(auth ? { authorization: auth } : {}),
    },
    body: raw ?? JSON.stringify(body),
  });
}

describe("POST /api/recipes/parse — Authentifizierung", () => {
  it("weist ohne Authorization-Header ab", async () => {
    const res = await POST(post({ text: "egal" }));
    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Nicht autorisiert." });
  });

  it("weist einen falschen Token ab", async () => {
    const res = await POST(post({ text: "egal" }, "Bearer falsch"));
    expect(res.status).toBe(401);
  });

  it("weist einen Token ab, der nur ein Präfix des richtigen ist", async () => {
    const res = await POST(post({ text: "egal" }, `Bearer ${TOKEN.slice(0, -1)}`));
    expect(res.status).toBe(401);
  });

  it("weist einen zu langen Token ab", async () => {
    const res = await POST(post({ text: "egal" }, `Bearer ${TOKEN}x`));
    expect(res.status).toBe(401);
  });

  it("antwortet 503, solange kein Token konfiguriert ist", async () => {
    delete process.env.RECIPE_IMPORT_TOKEN;
    const res = await POST(post({ text: "egal" }, `Bearer ${TOKEN}`));
    expect(res.status).toBe(503);
    await expect(res.json()).resolves.toMatchObject({ ok: false });
  });
});

describe("POST /api/recipes/parse — Body-Prüfung", () => {
  it("antwortet 400, wenn der Body kein JSON ist", async () => {
    const res = await POST(post(null, `Bearer ${TOKEN}`, "kein json"));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ ok: false, error: "Body ist kein JSON." });
  });

  it("antwortet 400, wenn weder Text noch Quell-URL kommen", async () => {
    const res = await POST(post({}, `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({
      ok: false,
      error: "Weder Text noch Quell-URL übergeben.",
    });
  });

  it("wertet reinen Leerraum wie fehlenden Text", async () => {
    const res = await POST(post({ text: "   \n  " }, `Bearer ${TOKEN}`));
    expect(res.status).toBe(400);
  });
});
