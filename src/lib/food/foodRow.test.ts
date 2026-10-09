import { describe, expect, it } from "vitest";
import { fromFoodRow, type FoodRow } from "./foodRow";

const row: FoodRow = {
  id: "abc",
  barcode: "3017620422003",
  name: "Crema",
  kcal_100g: 539,
  protein_100g: 6.3,
  carbs_100g: 57.5,
  fat_100g: 30.9,
  fiber_100g: null,
  sugar_100g: 56.3,
  salt_100g: 0.1,
};

describe("fromFoodRow", () => {
  it("convierte una fila completa y conserva su id para reutilizarla", () => {
    expect(fromFoodRow(row)).toMatchObject({
      id: "abc",
      barcode: "3017620422003",
      kcal100g: 539,
      fiber100g: null,
      incomplete: false,
    });
  });

  it("marca como incompleta la fila a la que le falta algún macro", () => {
    expect(fromFoodRow({ ...row, carbs_100g: null }).incomplete).toBe(true);
    expect(fromFoodRow({ ...row, protein_100g: null }).incomplete).toBe(true);
    expect(fromFoodRow({ ...row, fat_100g: null }).incomplete).toBe(true);
  });

  it("un macro a 0 no es un macro desconocido", () => {
    expect(fromFoodRow({ ...row, fat_100g: 0 }).incomplete).toBe(false);
  });
});
