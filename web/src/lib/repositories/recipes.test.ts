import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { createTestClient, resetDatabase } from "@/test/db";
import { PrismaClient } from "@/generated/prisma/client";

import {
  createRecipe,
  deleteRecipe,
  getRecipe,
  listRecipeOptions,
  listRecipeTags,
  listRecipes,
  setRecipeImage,
  setRecipeRating,
  updateRecipe,
  upsertImportedRecipe,
} from "./recipes";
import type { ImportedRecipe } from "@/lib/services/recipeImport";

describe("recipes repository", () => {
  let client: PrismaClient;

  beforeEach(async () => {
    client ??= createTestClient();
    await resetDatabase(client);
  });

  afterAll(async () => {
    await client?.$disconnect();
  });

  /** Legt ein vollständig ausgefülltes Rezept an und gibt seine id zurück. */
  async function seedCurry() {
    return createRecipe(
      {
        name: "Kokos-Curry",
        rating: "favorit",
        simple: false,
        reheatable: true,
        tags: ["curry", "vegan"],
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 25,
        kcal: 540,
        protein: 22,
        carbs: 55,
        fat: 9,
        steps: ["Zwiebeln anschwitzen.", "Kokosmilch zugeben."],
        notes: "Mit Naan servieren.",
        sourceUrl: "https://example.org/curry",
        ingredients: [
          { name: "Kokosmilch", amount: "400", unit: "ml", section: "Basis" },
          { name: "Spinat" },
        ],
      },
      client,
    );
  }

  describe("createRecipe / getRecipe", () => {
    it("legt ein Rezept mit allen Feldern an und liest es als DTO zurück", async () => {
      const { id } = await seedCurry();
      const saved = await getRecipe(id, client);

      expect(saved).toMatchObject({
        name: "Kokos-Curry",
        rating: "favorit",
        simple: false,
        reheatable: true,
        tags: ["curry", "vegan"],
        servings: 4,
        prepMinutes: 15,
        cookMinutes: 25,
        kcal: 540,
        protein: 22,
        notes: "Mit Naan servieren.",
        sourceUrl: "https://example.org/curry",
        archived: false,
      });
      expect(saved!.steps).toEqual(["Zwiebeln anschwitzen.", "Kokosmilch zugeben."]);
    });

    it("hält die Zutatenreihenfolge fest", async () => {
      const { id } = await seedCurry();
      const saved = await getRecipe(id, client);
      expect(saved!.ingredients.map((i) => i.name)).toEqual(["Kokosmilch", "Spinat"]);
      expect(saved!.ingredients[1]).toMatchObject({ amount: null, unit: null });
    });

    it("rechnet totalMinutes aus Vorbereitung + Kochzeit", async () => {
      const { id } = await seedCurry();
      expect((await getRecipe(id, client))!.totalMinutes).toBe(40);
    });

    it("liefert totalMinutes nur dann null, wenn beide Zeiten fehlen", async () => {
      const nurKochzeit = await createRecipe({ name: "A", cookMinutes: 20 }, client);
      const ohne = await createRecipe({ name: "B" }, client);
      expect((await getRecipe(nurKochzeit.id, client))!.totalMinutes).toBe(20);
      expect((await getRecipe(ohne.id, client))!.totalMinutes).toBeNull();
    });

    it("verwirft leere Zutatenzeilen aus dem Formular", async () => {
      const { id } = await createRecipe(
        { name: "X", ingredients: [{ name: "Reis" }, { name: "   " }] },
        client,
      );
      expect((await getRecipe(id, client))!.ingredients).toHaveLength(1);
    });

    it("gibt null für eine unbekannte id zurück", async () => {
      expect(await getRecipe("gibt-es-nicht", client)).toBeNull();
    });

    it("ordnet carbs, fat und protein im DTO nicht vertauscht zu", async () => {
      const { id } = await seedCurry();
      const recipe = await getRecipe(id, client);
      // Drei verschiedene Werte statt einer Konstante: ein vertauschtes Feld
      // (z.B. `carbs: row.protein`) fiele hier auf, bei gleichen Werten nicht.
      expect(recipe!.protein).toBe(22);
      expect(recipe!.carbs).toBe(55);
      expect(recipe!.fat).toBe(9);
      expect(recipe!.ingredients[0].section).toBe("Basis");
      expect(recipe!.ingredients[1].section).toBeNull();
    });
  });

  describe("listRecipes", () => {
    it("sortiert nach Name und lässt archivierte Rezepte weg", async () => {
      const all = await listRecipes({}, client);
      expect(all.length).toBeGreaterThan(0);
      expect(all.map((r) => r.name)).toEqual([...all.map((r) => r.name)].sort());

      await client.recipe.update({ where: { id: all[0].id }, data: { archived: true } });
      const after = await listRecipes({}, client);
      expect(after.find((r) => r.id === all[0].id)).toBeUndefined();
      expect(after).toHaveLength(all.length - 1);
    });

    it("reicht den Filter an die Suchlogik durch", async () => {
      await seedCurry();
      expect((await listRecipes({ query: "kokos-curry" }, client)).map((r) => r.name)).toEqual([
        "Kokos-Curry",
      ]);
      expect(await listRecipes({ query: "gibtesnicht" }, client)).toEqual([]);
    });

    it("sucht feldübergreifend — 'kokos' trifft auch Rezepte mit Kokosmilch als Zutat", async () => {
      await seedCurry();
      const treffer = await listRecipes({ query: "kokos" }, client);
      // Das Seed-Rezept "Gemüse-Curry" hat Kokosmilch in den Zutaten.
      expect(treffer.map((r) => r.name)).toContain("Gemüse-Curry");
      expect(treffer.map((r) => r.name)).toContain("Kokos-Curry");
    });

    it("findet Rezepte über eine Zutat", async () => {
      await seedCurry();
      const treffer = await listRecipes({ ingredient: "spinat" }, client);
      expect(treffer.map((r) => r.name)).toEqual(["Kokos-Curry"]);
    });
  });

  describe("listRecipeOptions", () => {
    it("liefert nur id und name, ohne archivierte", async () => {
      const options = await listRecipeOptions(true, client);
      expect(options.length).toBeGreaterThan(0);
      expect(Object.keys(options[0]).sort()).toEqual(["id", "name"]);

      await client.recipe.update({ where: { id: options[0].id }, data: { archived: true } });
      expect(await listRecipeOptions(true, client)).toHaveLength(options.length - 1);
    });

    it("blendet Snacks standardmaessig aus, ungefiltert liefert sie mit", async () => {
      await createRecipe({ name: "Energy-Balls", category: "snack" }, client);

      const gefiltert = await listRecipeOptions(true, client);
      expect(gefiltert.map((r) => r.name)).not.toContain("Energy-Balls");

      const ungefiltert = await listRecipeOptions(false, client);
      expect(ungefiltert.map((r) => r.name)).toContain("Energy-Balls");
    });
  });

  describe("listRecipeTags", () => {
    it("zählt die Tags aller aktiven Rezepte", async () => {
      const countOf = (list: { tag: string; count: number }[], tag: string) =>
        list.find((t) => t.tag === tag)?.count ?? 0;

      const before = await listRecipeTags(client);
      await createRecipe({ name: "AAA", tags: ["curry", "zzz-unikat"] }, client);
      await createRecipe({ name: "BBB", tags: ["curry"] }, client);
      const after = await listRecipeTags(client);

      expect(countOf(after, "curry")).toBe(countOf(before, "curry") + 2);
      expect(countOf(after, "zzz-unikat")).toBe(1);
    });

    it("sortiert nach Häufigkeit, seltene Tags landen hinten", async () => {
      await createRecipe({ name: "AAA", tags: ["zzz-unikat"] }, client);
      const tags = await listRecipeTags(client);
      const counts = tags.map((t) => t.count);
      expect(counts).toEqual([...counts].sort((a, b) => b - a));
      expect(tags.at(-1)!.count).toBe(1);
    });

    it("lässt archivierte Rezepte aus der Tagliste", async () => {
      const { id } = await createRecipe({ name: "AAA", tags: ["zzz-unikat"] }, client);
      await client.recipe.update({ where: { id }, data: { archived: true } });
      expect((await listRecipeTags(client)).find((t) => t.tag === "zzz-unikat")).toBeUndefined();
    });
  });

  describe("updateRecipe", () => {
    it("überschreibt Felder und ersetzt die Zutaten vollständig", async () => {
      const { id } = await seedCurry();

      await updateRecipe(
        id,
        {
          name: "Kokos-Curry mit Linsen",
          tags: ["curry"],
          servings: 6,
          steps: ["Alles in einen Topf."],
          ingredients: [{ name: "Rote Linsen", amount: "200", unit: "g" }],
        },
        client,
      );

      const saved = await getRecipe(id, client);
      expect(saved!.name).toBe("Kokos-Curry mit Linsen");
      expect(saved!.servings).toBe(6);
      expect(saved!.tags).toEqual(["curry"]);
      expect(saved!.steps).toEqual(["Alles in einen Topf."]);
      expect(saved!.ingredients.map((i) => i.name)).toEqual(["Rote Linsen"]);
    });

    it("setzt weggelassene Felder zurück statt sie stehen zu lassen", async () => {
      const { id } = await seedCurry();
      await updateRecipe(id, { name: "Kokos-Curry" }, client);

      const saved = await getRecipe(id, client);
      expect(saved!.kcal).toBeNull();
      expect(saved!.notes).toBeNull();
      expect(saved!.tags).toEqual([]);
      expect(saved!.ingredients).toEqual([]);
    });

    it("hinterlässt keine verwaisten Zutaten", async () => {
      const { id } = await seedCurry();
      await updateRecipe(id, { name: "X", ingredients: [{ name: "Reis" }] }, client);
      expect(await client.ingredient.count({ where: { recipeId: id } })).toBe(1);
    });
  });

  describe("deleteRecipe", () => {
    it("löscht ein Rezept, das in keinem Essensplan hängt", async () => {
      const { id } = await seedCurry();
      expect(await deleteRecipe(id, client)).toEqual({ deleted: true });
      expect(await getRecipe(id, client)).toBeNull();
      expect(await client.ingredient.count({ where: { recipeId: id } })).toBe(0);
    });

    it("archiviert statt zu löschen, wenn das Rezept noch verplant ist", async () => {
      const { id } = await seedCurry();
      await client.mealPlanEntry.create({ data: { date: new Date(), recipeId: id } });

      expect(await deleteRecipe(id, client)).toEqual({ deleted: false });

      const saved = await getRecipe(id, client);
      expect(saved).not.toBeNull();
      expect(saved!.archived).toBe(true);
      // Aus der Auswahl verschwunden, der Planeintrag löst aber weiter auf.
      expect((await listRecipes({}, client)).find((r) => r.id === id)).toBeUndefined();
    });
  });

  describe("setRecipeImage", () => {
    it("macht aus dem Dateinamen eine auslieferbare URL", async () => {
      const { id } = await seedCurry();
      expect((await getRecipe(id, client))!.imageUrl).toBeNull();

      await setRecipeImage(id, "kokos-curry.jpg", client);

      expect((await getRecipe(id, client))!.imageUrl).toBe("/api/recipe-image/kokos-curry.jpg");
    });

    it("nimmt das Bild mit null wieder weg", async () => {
      const { id } = await seedCurry();
      await setRecipeImage(id, "kokos-curry.jpg", client);
      await setRecipeImage(id, null, client);
      expect((await getRecipe(id, client))!.imageUrl).toBeNull();
    });

    // Das Titelbild hängt nicht am Formular — wer ein Rezept im Editor
    // bearbeitet, schickt kein `imagePath` mit. Ohne Schutz würde jedes
    // Speichern das heruntergeladene Bild löschen.
    it("überlebt das Bearbeiten des Rezepts im Editor", async () => {
      const { id } = await seedCurry();
      await setRecipeImage(id, "kokos-curry.jpg", client);

      await updateRecipe(
        id,
        { name: "Kokos-Curry mit Reis", ingredients: [{ name: "Kokosmilch" }] },
        client,
      );

      const saved = await getRecipe(id, client);
      expect(saved!.name).toBe("Kokos-Curry mit Reis");
      expect(saved!.imageUrl).toBe("/api/recipe-image/kokos-curry.jpg");
    });
  });

  describe("setRecipeRating", () => {
    it("ändert nur die Bewertung", async () => {
      const { id } = await seedCurry();
      await setRecipeRating(id, "selten", client);
      const saved = await getRecipe(id, client);
      expect(saved!.rating).toBe("selten");
      expect(saved!.name).toBe("Kokos-Curry");
    });
  });

  describe("upsertImportedRecipe", () => {
    /** Ein importiertes Rezept, wie es aus recipeImport/recipeIdeas kommt. */
    function imported(overrides: Partial<ImportedRecipe> = {}): ImportedRecipe {
      return {
        slug: "kokos-curry",
        name: "Kokos-Curry",
        rating: "ok",
        simple: true,
        reheatable: false,
        category: "hauptmahlzeit",
        tags: ["curry"],
        source: "https://example.org/curry",
        imageUrl: null,
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 20,
        kcal: 480,
        protein: 20,
        carbs: null,
        fat: null,
        ingredients: [{ name: "Kokosmilch", amount: "400", unit: "ml" }],
        steps: ["Alles kochen."],
        ...overrides,
      };
    }

    it("legt ein neues Rezept samt Slug an", async () => {
      const { id, updated } = await upsertImportedRecipe(imported(), client);

      expect(updated).toBe(false);
      const saved = await getRecipe(id, client);
      expect(saved).toMatchObject({
        name: "Kokos-Curry",
        slug: "kokos-curry",
        servings: 4,
        kcal: 480,
        sourceUrl: "https://example.org/curry",
        steps: ["Alles kochen."],
      });
      expect(saved!.ingredients).toEqual([
        expect.objectContaining({ name: "Kokosmilch", amount: "400", unit: "ml" }),
      ]);
    });

    it("erkennt dasselbe Rezept an der Quell-URL wieder, auch nach Umbenennung", async () => {
      const first = await upsertImportedRecipe(imported(), client);
      const second = await upsertImportedRecipe(
        imported({ name: "Kokos-Curry (neu)", slug: "kokos-curry-neu", kcal: 500 }),
        client,
      );

      expect(second.updated).toBe(true);
      expect(second.id).toBe(first.id);
      expect(await client.recipe.count({ where: { slug: { startsWith: "kokos-curry" } } })).toBe(1);

      const saved = await getRecipe(first.id, client);
      expect(saved!.name).toBe("Kokos-Curry (neu)");
      expect(saved!.kcal).toBe(500);
      // Der Slug ist der Identitäts-Anker und wandert nicht mit dem Namen.
      expect(saved!.slug).toBe("kokos-curry");
    });

    it("erkennt ein Rezept ohne Quell-URL am Slug wieder (Claude-Ideen)", async () => {
      const idea = imported({ source: null, kcal: null });
      const first = await upsertImportedRecipe(idea, client);
      const second = await upsertImportedRecipe(idea, client);

      expect(second.updated).toBe(true);
      expect(second.id).toBe(first.id);
      expect(await client.recipe.count({ where: { slug: { startsWith: "kokos-curry" } } })).toBe(1);
    });

    it("lässt Bewertung, Notizen und Bild des Haushalts in Ruhe", async () => {
      const { id } = await upsertImportedRecipe(imported(), client);
      await client.recipe.update({
        where: { id },
        data: { rating: "favorit", notes: "Mit Naan.", imagePath: "kokos-curry.jpg" },
      });

      await upsertImportedRecipe(imported({ rating: "ok" }), client);

      const saved = await getRecipe(id, client);
      expect(saved!.rating).toBe("favorit");
      expect(saved!.notes).toBe("Mit Naan.");
      expect(saved!.imageUrl).toContain("kokos-curry.jpg");
    });

    it("ersetzt die Zutaten, statt sie zu verdoppeln", async () => {
      const { id } = await upsertImportedRecipe(imported(), client);
      await upsertImportedRecipe(
        imported({ ingredients: [{ name: "Reis", amount: "200", unit: "g" }] }),
        client,
      );

      const saved = await getRecipe(id, client);
      expect(saved!.ingredients.map((i) => i.name)).toEqual(["Reis"]);
    });

    it("holt ein archiviertes Rezept zurück, statt eine Dublette anzulegen", async () => {
      const { id } = await upsertImportedRecipe(imported(), client);
      await client.recipe.update({ where: { id }, data: { archived: true } });

      const again = await upsertImportedRecipe(imported(), client);

      expect(again.id).toBe(id);
      expect((await getRecipe(id, client))!.archived).toBe(false);
      expect(await client.recipe.count({ where: { slug: { startsWith: "kokos-curry" } } })).toBe(1);
    });

    it("landet über den Slug beim bestehenden Rezept, wenn die Quelle wechselt", async () => {
      await upsertImportedRecipe(imported({ source: "https://example.org/a" }), client);
      const { id, updated } = await upsertImportedRecipe(
        imported({ source: "https://example.org/b" }),
        client,
      );

      expect(updated).toBe(true);
      expect(await client.recipe.count({ where: { slug: { startsWith: "kokos-curry" } } })).toBe(1);
      expect((await getRecipe(id, client))!.sourceUrl).toBe("https://example.org/b");
    });

    it("nimmt einem anderen Rezept den Slug nicht weg", async () => {
      // `slug` ist unique. Ein handangelegtes Rezept (Slug null) wird hier über
      // seine Quell-URL getroffen, während den passenden Slug schon ein anderes
      // Rezept trägt — ein blinder Schreibversuch würde die DB anfahren.
      await upsertImportedRecipe(imported({ source: "https://example.org/a" }), client);
      const handmade = await createRecipe(
        { name: "Kokos-Curry", sourceUrl: "https://example.org/b" },
        client,
      );

      const again = await upsertImportedRecipe(
        imported({ source: "https://example.org/b" }),
        client,
      );

      expect(again.id).toBe(handmade.id);
      expect((await getRecipe(handmade.id, client))!.slug).toBeNull();
    });

    it("übernimmt carbs, fat und Zutaten-Gruppen beim Import", async () => {
      const imported: ImportedRecipe = {
        slug: "linsen-dal",
        name: "Linsen-Dal",
        rating: "ok",
        simple: true,
        reheatable: true,
        category: "hauptmahlzeit",
        tags: ["vegetarisch"],
        source: null,
        imageUrl: null,
        servings: 4,
        prepMinutes: 10,
        cookMinutes: 25,
        kcal: 420,
        protein: 18,
        carbs: 55,
        fat: 9,
        ingredients: [
          { name: "Rote Linsen", amount: "200", unit: "g", section: null },
          { name: "Skyr", amount: "150", unit: "g", section: "Dip" },
        ],
        steps: ["Linsen waschen.", "25 Minuten köcheln."],
      };

      const { id } = await upsertImportedRecipe(imported, client);
      const row = await client.recipe.findUnique({
        where: { id },
        include: { ingredients: { orderBy: { sort: "asc" } } },
      });

      expect(row?.carbs).toBe(55);
      expect(row?.fat).toBe(9);
      expect(row?.ingredients.map((i) => i.section)).toEqual([null, "Dip"]);
    });

    it("lässt die Bewertung des Haushalts standardmäßig in Ruhe, auch bei einer anderen im Payload", async () => {
      const { id } = await upsertImportedRecipe(imported(), client);
      await client.recipe.update({ where: { id }, data: { rating: "favorit" } });

      await upsertImportedRecipe(imported({ rating: "selten" }), client);

      expect((await getRecipe(id, client))!.rating).toBe("favorit");
    });

    it("übernimmt die Bewertung aus dem Payload, wenn der Aufrufer das per Option erlaubt", async () => {
      // Simuliert POST /api/recipes/import: dort ist die Bewertung eine bewusste
      // Nutzerentscheidung im App-Preview, kein automatischer Import.
      const { id } = await upsertImportedRecipe(imported(), client);
      await client.recipe.update({ where: { id }, data: { rating: "favorit" } });

      await upsertImportedRecipe(imported({ rating: "selten" }), client, {
        allowRatingOverride: true,
      });

      expect((await getRecipe(id, client))!.rating).toBe("selten");
    });

    it("hält zwei Rezepte mit leerem Slug auseinander, statt sie zu verschmelzen", async () => {
      // Ein Name ganz ohne ASCII-Alphanumerisches (rein kyrillisch/chinesisch)
      // ergibt über slugFromName einen leeren Slug. `slug` ist unique — ohne
      // Guard würde findImportMatch das zweite Rezept über das erste finden.
      const a = await upsertImportedRecipe(
        imported({ slug: "", name: "Рецепт А", source: null }),
        client,
      );
      const b = await upsertImportedRecipe(
        imported({ slug: "", name: "Рецепт Б", source: null }),
        client,
      );

      expect(a.id).not.toBe(b.id);
      expect((await getRecipe(a.id, client))!.name).toBe("Рецепт А");
      expect((await getRecipe(b.id, client))!.name).toBe("Рецепт Б");
      expect((await getRecipe(a.id, client))!.slug).toBeNull();
      expect((await getRecipe(b.id, client))!.slug).toBeNull();
    });
  });

  describe("category", () => {
    it("legt neue Rezepte als Hauptmahlzeit an", async () => {
      const { id } = await createRecipe({ name: "Testgericht" }, client);
      const recipe = await getRecipe(id, client);
      expect(recipe?.category).toBe("hauptmahlzeit");
    });

    it("uebernimmt eine gesetzte Kategorie", async () => {
      const { id } = await createRecipe({ name: "Testriegel", category: "snack" }, client);
      expect((await getRecipe(id, client))?.category).toBe("snack");
    });

    it("faellt bei Unfug auf hauptmahlzeit zurueck", async () => {
      const { id } = await createRecipe({ name: "Testunfug", category: "voelliger-quatsch" }, client);
      expect((await getRecipe(id, client))?.category).toBe("hauptmahlzeit");
    });
  });
});
