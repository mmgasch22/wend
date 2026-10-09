import { describe, expect, it } from "vitest";
import { interpretProductResponse, interpretSearchFallbackResponse } from "./barcodeLookup";

const CODE = "3017620422003";

const completeProduct = {
  code: CODE,
  product_name: "Crema de cacao",
  brands: "Marca X, Otra",
  nutriments: {
    "energy-kcal_100g": 539,
    proteins_100g: 6.3,
    carbohydrates_100g: 57.5,
    fat_100g: 30.9,
    fiber_100g: 0,
    sugars_100g: 56.3,
    salt_100g: 0.107,
  },
};

describe("interpretProductResponse", () => {
  it("producto encontrado con datos completos", () => {
    const result = interpretProductResponse(CODE, 200, { status: 1, product: completeProduct });
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.source).toBe("openfoodfacts");
    expect(result.food).toMatchObject({
      id: null,
      barcode: CODE,
      name: "Crema de cacao (Marca X, Otra)",
      kcal100g: 539,
      protein100g: 6.3,
      carbs100g: 57.5,
      fat100g: 30.9,
      incomplete: false,
    });
  });

  it("producto encontrado con macros incompletos: no inventa ceros", () => {
    const result = interpretProductResponse(CODE, 200, {
      status: 1,
      product: {
        ...completeProduct,
        nutriments: { "energy-kcal_100g": 539, proteins_100g: 6.3 },
      },
    });
    expect(result.status).toBe("found");
    if (result.status !== "found") return;
    expect(result.food.incomplete).toBe(true);
    expect(result.food.carbs100g).toBeNull();
    expect(result.food.fat100g).toBeNull();
    expect(result.food.protein100g).toBe(6.3);
  });

  it("usa el nombre en castellano o el genérico si falta el principal", () => {
    const withSpanish = interpretProductResponse(CODE, 200, {
      status: 1,
      product: { ...completeProduct, brands: undefined, product_name: "", product_name_es: "Crema" },
    });
    expect(withSpanish.status === "found" && withSpanish.food.name).toBe("Crema");

    const withGeneric = interpretProductResponse(CODE, 200, {
      status: 1,
      product: { ...completeProduct, brands: undefined, product_name: undefined, generic_name: "Pasta de cacao" },
    });
    expect(withGeneric.status === "found" && withGeneric.food.name).toBe("Pasta de cacao");
  });

  it("guarda el producto con el código escaneado, no con el que devuelva la API", () => {
    const result = interpretProductResponse(CODE, 200, {
      status: 1,
      product: { ...completeProduct, code: "00000000" },
    });
    expect(result.status === "found" && result.food.barcode).toBe(CODE);
  });

  it("código inexistente: HTTP 200 con status 0 es not_found, no un error", () => {
    expect(
      interpretProductResponse(CODE, 200, { status: 0, status_verbose: "product not found" }),
    ).toEqual({ status: "not_found", barcode: CODE });
  });

  it("también reconoce el 404 con status 0 como not_found", () => {
    expect(interpretProductResponse(CODE, 404, { status: 0 })).toEqual({
      status: "not_found",
      barcode: CODE,
    });
  });

  it("producto sin calorías: insufficient_data con su nombre", () => {
    const result = interpretProductResponse(CODE, 200, {
      status: 1,
      product: { code: CODE, product_name: "Galletas", nutriments: {} },
    });
    expect(result).toEqual({ status: "insufficient_data", barcode: CODE, name: "Galletas" });
  });

  it("producto sin nombre: insufficient_data sin nombre", () => {
    const result = interpretProductResponse(CODE, 200, {
      status: 1,
      product: { code: CODE, nutriments: { "energy-kcal_100g": 100 } },
    });
    expect(result).toEqual({ status: "insufficient_data", barcode: CODE, name: null });
  });

  it("errores del servicio son unavailable, nunca not_found", () => {
    expect(interpretProductResponse(CODE, 503, null)).toEqual({ status: "unavailable" });
    expect(interpretProductResponse(CODE, 500, { status: 0 })).toEqual({ status: "unavailable" });
    expect(interpretProductResponse(CODE, 429, {})).toEqual({ status: "unavailable" });
  });

  it("un cuerpo que no es JSON (p. ej. una página de error) es unavailable", () => {
    expect(interpretProductResponse(CODE, 200, null)).toEqual({ status: "unavailable" });
    expect(interpretProductResponse(CODE, 404, null)).toEqual({ status: "unavailable" });
  });

  it("un 200 sin producto ni aviso no se toma por 'no existe'", () => {
    expect(interpretProductResponse(CODE, 200, { status: 1 })).toEqual({ status: "unavailable" });
    expect(interpretProductResponse(CODE, 200, {})).toEqual({ status: "unavailable" });
  });
});

describe("interpretSearchFallbackResponse", () => {
  it("encuentra el producto por su código", () => {
    const result = interpretSearchFallbackResponse(CODE, 200, {
      hits: [{ ...completeProduct, brands: ["Marca X"] }],
    });
    expect(result.status === "found" && result.food.name).toBe("Crema de cacao (Marca X)");
  });

  it("sin resultados NO se interpreta como 'no existe' (el índice puede ir atrasado)", () => {
    expect(interpretSearchFallbackResponse(CODE, 200, { hits: [] })).toEqual({
      status: "unavailable",
    });
  });

  it("ignora resultados con otro código", () => {
    expect(
      interpretSearchFallbackResponse(CODE, 200, { hits: [{ ...completeProduct, code: "111" }] }),
    ).toEqual({ status: "unavailable" });
  });

  it("errores o cuerpos inválidos son unavailable", () => {
    expect(interpretSearchFallbackResponse(CODE, 503, { hits: [] })).toEqual({ status: "unavailable" });
    expect(interpretSearchFallbackResponse(CODE, 200, null)).toEqual({ status: "unavailable" });
  });

  it("producto sin calorías en el respaldo: insufficient_data", () => {
    const result = interpretSearchFallbackResponse(CODE, 200, {
      hits: [{ code: CODE, product_name: "Galletas", nutriments: {} }],
    });
    expect(result).toEqual({ status: "insufficient_data", barcode: CODE, name: "Galletas" });
  });
});
