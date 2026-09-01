// Route-Tests bis zur Validierungsgrenze: Auth und Body-Prüfung. Der Erfolgsfall
// ruft die Extraktion (Abo-Kontingent) bzw. eine fremde Seite auf und wird
// deshalb hier nicht angefasst — den deckt der End-to-End-Lauf gegen das Tablet ab.

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Für den asynchronen Modus (siehe unten) muss die Extraktion gemockt werden,
// sonst liefe der Erfolgsfall gegen das echte Claude-Abo. Gleiches Muster wie
// in api/recipes/import/route.test.ts.
vi.mock("@/lib/services/recipeExtract", () => ({
  extractRecipeFromText: vi.fn(),
}));

import { extractRecipeFromText } from "@/lib/services/recipeExtract";
import type { ImportedRecipe } from "@/lib/services/recipeImport";
import { __resetJobsForTest } from "@/lib/services/importJobs";
import { GET, POST } from "./route";

const TOKEN = "test-token-1234567890";
let original: string | undefined;

beforeEach(() => {
  original = process.env.RECIPE_IMPORT_TOKEN;
  process.env.RECIPE_IMPORT_TOKEN = TOKEN;
  __resetJobsForTest();
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

/** POST mit gültigem Token — Kurzform für die Tests des asynchronen Modus. */
function authorizedRequest(body: unknown): Request {
  return post(body, `Bearer ${TOKEN}`);
}

/** GET mit gültigem Token, Query an die URL gehängt. */
function authorizedGet(query: string): Request {
  return new Request(`http://localhost/api/recipes/parse${query}`, {
    headers: { authorization: `Bearer ${TOKEN}` },
  });
}

const IMPORTED: ImportedRecipe = {
  slug: "linsen-dal",
  name: "Linsen-Dal",
  rating: "favorit",
  simple: true,
  reheatable: true,
  category: "hauptmahlzeit",
  tags: ["indisch"],
  source: null,
  imageUrl: null,
  servings: 2,
  prepMinutes: 10,
  cookMinutes: 20,
  kcal: null,
  protein: null,
  carbs: null,
  fat: null,
  ingredients: [{ name: "Rote Linsen", amount: "200", unit: "g" }],
  steps: ["Linsen kochen."],
};

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

describe("asynchroner Modus", () => {
  it("antwortet sofort mit einer Job-Id", async () => {
    vi.mocked(extractRecipeFromText).mockResolvedValue(IMPORTED);

    const res = await POST(authorizedRequest({ text: "irgendwas", async: true }));

    expect(res.status).toBe(202);
    expect((await res.json()).jobId).toEqual(expect.any(String));
  });

  it("liefert das Ergebnis ueber GET nach", async () => {
    vi.mocked(extractRecipeFromText).mockResolvedValue(IMPORTED);
    const { jobId } = await (await POST(authorizedRequest({ text: "x", async: true }))).json();

    // Die Extraktion läuft als nicht abgewarteter Promise — eine Runde durch
    // die Microtask-Queue genügt, damit sie fertig ist.
    await new Promise((r) => setTimeout(r, 0));

    const res = await GET(authorizedGet(`?job=${jobId}`));
    const body = await res.json();
    expect(body.status).toBe("done");
    expect(body.recipe.name).toBe(IMPORTED.name);
  });

  it("meldet einen Fehler der Extraktion im Job", async () => {
    vi.mocked(extractRecipeFromText).mockRejectedValue(new Error("kein Rezept"));
    const { jobId } = await (await POST(authorizedRequest({ text: "x", async: true }))).json();
    await new Promise((r) => setTimeout(r, 0));

    const body = await (await GET(authorizedGet(`?job=${jobId}`))).json();
    expect(body).toMatchObject({ status: "error", error: "kein Rezept" });
  });

  it("kennt unbekannte Job-Ids nicht", async () => {
    expect((await GET(authorizedGet("?job=gibtsnicht"))).status).toBe(404);
  });

  it("laesst GET ohne Token nicht durch", async () => {
    const res = await GET(new Request("http://x/api/recipes/parse?job=egal"));
    expect(res.status).toBe(401);
  });
});
