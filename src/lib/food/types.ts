export interface FoodSearchResult {
  // Presente solo cuando el resultado ya existe en tu base (un alimento
  // manual tuyo reencontrado) — permite reutilizarlo sin duplicarlo.
  id: string | null;
  barcode: string | null;
  name: string;
  kcal100g: number;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
  fiber100g: number | null;
  sugar100g: number | null;
  salt100g: number | null;
  // true si falta proteína, carbohidratos o grasa — nunca se interpreta
  // como 0, se muestra explícitamente como incompleto.
  incomplete: boolean;
}

export interface FoodSearchResponse {
  yourFoods: FoodSearchResult[];
  openFoodFacts: FoodSearchResult[];
  // true si no se pudo consultar OpenFoodFacts (no es lo mismo que "sin
  // resultados": el usuario debe saber que puede reintentar).
  openFoodFactsUnavailable?: boolean;
}

// Resultado de buscar un producto por su código de barras. Cada caso exige
// una reacción distinta en pantalla, por eso no se reduce a "hay / no hay":
//   found             -> se muestra la ficha para confirmar y elegir cantidad.
//   insufficient_data -> el producto existe pero sin nombre o sin calorías:
//                        se ofrece crearlo a mano asociándole el código.
//   not_found         -> el código no existe en OpenFoodFacts.
//   unavailable       -> el servicio falló: NO se sabe si existe; reintentar.
//   invalid_code      -> no es un código de barras válido (errata, lectura mala).
export type BarcodeLookupResult =
  | { status: "found"; source: "local" | "openfoodfacts"; food: FoodSearchResult }
  | { status: "insufficient_data"; barcode: string; name: string | null }
  | { status: "not_found"; barcode: string }
  | { status: "unavailable" }
  | { status: "invalid_code" };

// Una comida habitual del usuario (Desayuno, "Post-entreno"...). No depende
// de la fecha — food_logs.date es lo que sitúa un registro en un día
// concreto; esto es solo "qué comidas existen".
export interface MealSlot {
  id: string;
  name: string;
  sort_order: number;
}
