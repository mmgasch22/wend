import { describe, expect, it } from "vitest";
import { mapOpenFoodFactsProduct, mapOpenFoodFactsProducts } from "./openFoodFacts";

const completeProduct = {
  code: "111",
  product_name: "Yogur Natural",
  brands: ["Alteza"],
  nutriments: {
    "energy-kcal_100g": 59,
    proteins_100g: 3.9,
    carbohydrates_100g: 4.9,
    fat_100g: 2.6,
  },
};

describe("mapOpenFoodFactsProduct", () => {
  it("mapea un producto completo y añade la marca al nombre", () => {
    const result = mapOpenFoodFactsProduct(completeProduct);
    expect(result).toMatchObject({
      id: null,
      barcode: "111",
      name: "Yogur Natural (Alteza)",
      kcal100g: 59,
      protein100g: 3.9,
      incomplete: false,
    });
  });

  it("acepta la marca como texto (API antigua) o como array (API nueva)", () => {
    expect(mapOpenFoodFactsProduct({ ...completeProduct, brands: "Alteza,Otra" })?.name).toBe(
      "Yogur Natural (Alteza,Otra)",
    );
    expect(mapOpenFoodFactsProduct({ ...completeProduct, brands: ["A", "B"] })?.name).toBe(
      "Yogur Natural (A, B)",
    );
  });

  it("marca como incompleto el producto al que le falta algún macro, sin ponerlo a 0", () => {
    const result = mapOpenFoodFactsProduct({
      ...completeProduct,
      nutriments: { "energy-kcal_100g": 59, proteins_100g: 3.9 },
    });
    expect(result?.incomplete).toBe(true);
    expect(result?.carbs100g).toBeNull();
    expect(result?.fat100g).toBeNull();
  });

  it("descarta productos sin nombre o sin kcal", () => {
    expect(mapOpenFoodFactsProduct({ ...completeProduct, product_name: undefined })).toBeNull();
    expect(mapOpenFoodFactsProduct({ ...completeProduct, nutriments: {} })).toBeNull();
  });
});

describe("mapOpenFoodFactsProducts", () => {
  it("elimina duplicados por código de barras y los productos inválidos", () => {
    const results = mapOpenFoodFactsProducts([
      completeProduct,
      completeProduct,
      { code: "222", nutriments: {} },
    ]);
    expect(results).toHaveLength(1);
  });
});
