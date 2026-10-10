import { describe, expect, it } from "vitest";
import { PAGE_SIZE, TABLAS, fetchAll, flatten, type PageReader } from "./userData";

function readerOf(total: number): PageReader {
  const all = Array.from({ length: total }, (_, i) => ({ id: i }));
  return async (_t, from, to) => ({ data: all.slice(from, to + 1), error: null });
}

describe("fetchAll", () => {
  it("recorre todas las páginas, incluso más de 1000 filas", async () => {
    const rows = await fetchAll(readerOf(PAGE_SIZE * 2 + 5), TABLAS.comidas);
    expect(rows).toHaveLength(PAGE_SIZE * 2 + 5);
    expect(new Set(rows.map((r) => r.id)).size).toBe(PAGE_SIZE * 2 + 5);
  });

  it("termina bien con un múltiplo exacto del tamaño de página", async () => {
    const rows = await fetchAll(readerOf(PAGE_SIZE), TABLAS.peso);
    expect(rows).toHaveLength(PAGE_SIZE);
  });

  it("devuelve vacío sin datos", async () => {
    expect(await fetchAll(readerOf(0), TABLAS.peso)).toEqual([]);
  });

  it("propaga el error de la base de datos", async () => {
    const failing: PageReader = async () => ({ data: null, error: { message: "boom" } });
    await expect(fetchAll(failing, TABLAS.peso)).rejects.toThrow("boom");
  });
});

describe("flatten", () => {
  it("aplana el alimento anidado en las comidas", () => {
    const flat = flatten(TABLAS.comidas, {
      date: "2026-10-10",
      meal_type: "lunch",
      grams: 150,
      foods: { name: "Arroz", barcode: null, kcal_100g: 130 },
    });
    expect(flat).toMatchObject({ food_name: "Arroz", kcal_100g: 130, grams: 150 });
    expect(flat).not.toHaveProperty("foods");
  });

  it("deja igual las tablas sin anidar", () => {
    expect(flatten(TABLAS.peso, { date: "2026-10-10", weight_kg: 80 })).toEqual({
      date: "2026-10-10",
      weight_kg: 80,
    });
  });

  it("las columnas de CSV de comidas existen tras aplanar y no incluyen datos ajenos", () => {
    expect(TABLAS.comidas.select).not.toContain("created_by");
    for (const t of Object.values(TABLAS)) expect(t.select).not.toContain("created_by");
  });
});
