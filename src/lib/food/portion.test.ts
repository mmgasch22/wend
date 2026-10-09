import { describe, expect, it } from "vitest";
import { formatMacroGrams, joinLabels, missingMacroLabels, scaleNutrients } from "./portion";

const yogurt = { kcal100g: 59, protein100g: 3.9, carbs100g: 4.9, fat100g: 2.6 };

describe("scaleNutrients", () => {
  it("escala los valores por 100 g a la cantidad elegida", () => {
    expect(scaleNutrients(yogurt, 125)).toEqual({ kcal: 74, protein: 5, carbs: 6, fat: 3 });
  });

  it("100 g devuelve los valores originales redondeados", () => {
    expect(scaleNutrients(yogurt, 100)).toEqual({ kcal: 59, protein: 4, carbs: 5, fat: 3 });
  });

  it("admite cantidades decimales y mayores de 100 g", () => {
    expect(scaleNutrients({ ...yogurt, kcal100g: 200 }, 12.5)?.kcal).toBe(25);
    expect(scaleNutrients({ ...yogurt, kcal100g: 200 }, 350)?.kcal).toBe(700);
  });

  it("un macro desconocido sigue siendo null, nunca 0", () => {
    const result = scaleNutrients({ kcal100g: 100, protein100g: 5, carbs100g: null, fat100g: null }, 200);
    expect(result).toEqual({ kcal: 200, protein: 10, carbs: null, fat: null });
  });

  it("un macro que vale 0 de verdad se conserva como 0", () => {
    expect(scaleNutrients({ kcal100g: 100, protein100g: 0, carbs100g: 0, fat100g: 0 }, 50)).toEqual({
      kcal: 50,
      protein: 0,
      carbs: 0,
      fat: 0,
    });
  });

  it("cantidades no válidas no producen resultado", () => {
    expect(scaleNutrients(yogurt, 0)).toBeNull();
    expect(scaleNutrients(yogurt, -5)).toBeNull();
    expect(scaleNutrients(yogurt, Number.NaN)).toBeNull();
    expect(scaleNutrients(yogurt, Number.POSITIVE_INFINITY)).toBeNull();
  });
});

describe("formatMacroGrams", () => {
  it("muestra los gramos o 'sin dato'", () => {
    expect(formatMacroGrams(12)).toBe("12 g");
    expect(formatMacroGrams(0)).toBe("0 g");
    expect(formatMacroGrams(null)).toBe("— sin dato");
  });
});

describe("missingMacroLabels", () => {
  it("no devuelve nada si el alimento está completo", () => {
    expect(missingMacroLabels(yogurt)).toEqual([]);
  });

  it("nombra solo los macros que faltan, en orden", () => {
    expect(
      missingMacroLabels({ kcal100g: 100, protein100g: 5, carbs100g: null, fat100g: null }),
    ).toEqual(["carbohidratos", "grasa"]);
    expect(
      missingMacroLabels({ kcal100g: 100, protein100g: null, carbs100g: null, fat100g: null }),
    ).toEqual(["proteína", "carbohidratos", "grasa"]);
  });

  it("un macro a 0 no cuenta como faltante", () => {
    expect(
      missingMacroLabels({ kcal100g: 100, protein100g: 0, carbs100g: 0, fat100g: 0 }),
    ).toEqual([]);
  });
});

describe("joinLabels", () => {
  it("une en lenguaje natural", () => {
    expect(joinLabels([])).toBe("");
    expect(joinLabels(["grasa"])).toBe("grasa");
    expect(joinLabels(["carbohidratos", "grasa"])).toBe("carbohidratos y grasa");
    expect(joinLabels(["proteína", "carbohidratos", "grasa"])).toBe(
      "proteína, carbohidratos y grasa",
    );
  });
});
