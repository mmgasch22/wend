// Definición de qué se exporta y cómo se lee. Separado de la ruta para poder
// probarlo con un cliente falso. No se exportan columnas ajenas (p. ej.
// foods.created_by).

import type { CsvCell } from "./csv";

export const PAGE_SIZE = 1000; // límite de filas por petición de PostgREST

// Lee una página de filas de una tabla para un usuario. La ruta lo implementa
// con Supabase; las pruebas, con datos en memoria.
export type PageReader = (
  t: Tabla,
  from: number,
  to: number,
) => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }>;

export type Tabla = {
  tabla: string;
  from: string;
  select: string;
  userColumn: string;
  order: string;
  csvColumns: readonly string[];
};

export const TABLAS: Record<string, Tabla> = {
  perfil: {
    tabla: "perfil",
    from: "profiles",
    select:
      "name, birth_date, sex, height_cm, activity_level, goal, daily_steps_goal, daily_water_goal_ml, created_at",
    userColumn: "id",
    order: "created_at",
    csvColumns: [
      "name", "birth_date", "sex", "height_cm", "activity_level", "goal",
      "daily_steps_goal", "daily_water_goal_ml", "created_at",
    ],
  },
  objetivos: {
    tabla: "objetivos",
    from: "calorie_targets",
    select: "effective_date, kcal_target, protein_g, carbs_g, fat_g",
    userColumn: "user_id",
    order: "effective_date",
    csvColumns: ["effective_date", "kcal_target", "protein_g", "carbs_g", "fat_g"],
  },
  peso: {
    tabla: "peso",
    from: "weight_logs",
    select: "date, weight_kg",
    userColumn: "user_id",
    order: "date",
    csvColumns: ["date", "weight_kg"],
  },
  pasos: {
    tabla: "pasos",
    from: "steps_logs",
    select: "date, value",
    userColumn: "user_id",
    order: "date",
    csvColumns: ["date", "value"],
  },
  agua: {
    tabla: "agua",
    from: "water_logs",
    select: "date, value_ml",
    userColumn: "user_id",
    order: "date",
    csvColumns: ["date", "value_ml"],
  },
  comidas_nombres: {
    tabla: "comidas_nombres",
    from: "meal_slots",
    select: "name, sort_order",
    userColumn: "user_id",
    order: "sort_order",
    csvColumns: ["name", "sort_order"],
  },
  comidas: {
    tabla: "comidas",
    from: "food_logs",
    select:
      "date, grams, meal_slot_id, meal_slots(name), foods(name, barcode, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g)",
    userColumn: "user_id",
    order: "date",
    csvColumns: [
      "date", "meal_name", "grams", "food_name", "barcode", "kcal_100g",
      "protein_100g", "carbs_100g", "fat_100g", "fiber_100g", "sugar_100g",
      "salt_100g",
    ],
  },
};

export type Row = Record<string, unknown>;

// Pagina hasta agotar las filas: sin esto, cuentas con más de 1000 registros
// saldrían truncadas sin avisar.
export async function fetchAll(readPage: PageReader, t: Tabla): Promise<Row[]> {
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await readPage(t, from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as Row[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return rows;
  }
}

// En comidas, el alimento viene anidado; en el CSV se aplana.
export function flatten(t: Tabla, row: Row): Record<string, CsvCell> {
  if (t.tabla !== "comidas") return row as Record<string, CsvCell>;
  const food = (row.foods ?? {}) as Record<string, CsvCell>;
  const slot = (row.meal_slots ?? {}) as Record<string, CsvCell>;
  const flat: Record<string, CsvCell> = { ...(row as Record<string, CsvCell>) };
  delete flat.foods;
  delete flat.meal_slots;
  // meal_name vacío = comida sin tramo asignado (meal_slot_id null).
  return { ...flat, ...food, food_name: food.name, meal_name: slot.name };
}

