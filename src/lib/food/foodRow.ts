import type { FoodSearchResult } from "./types";

// Fila de la tabla `foods` tal como la devuelve Supabase. Compartida por las
// dos rutas que leen alimentos (búsqueda por texto y por código de barras).
export interface FoodRow {
  id: string;
  barcode: string | null;
  name: string;
  kcal_100g: number;
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
  fiber_100g: number | null;
  sugar_100g: number | null;
  salt_100g: number | null;
}

export const FOOD_SELECT_COLUMNS =
  "id, barcode, name, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g";

function isIncomplete(row: {
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
}): boolean {
  return row.protein_100g === null || row.carbs_100g === null || row.fat_100g === null;
}

export function fromFoodRow(row: FoodRow): FoodSearchResult {
  return {
    id: row.id,
    barcode: row.barcode,
    name: row.name,
    kcal100g: row.kcal_100g,
    protein100g: row.protein_100g,
    carbs100g: row.carbs_100g,
    fat100g: row.fat_100g,
    fiber100g: row.fiber_100g,
    sugar100g: row.sugar_100g,
    salt100g: row.salt_100g,
    incomplete: isIncomplete(row),
  };
}
