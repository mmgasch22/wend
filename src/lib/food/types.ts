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

// Una comida habitual del usuario (Desayuno, "Post-entreno"...). No depende
// de la fecha — food_logs.date es lo que sitúa un registro en un día
// concreto; esto es solo "qué comidas existen".
export interface MealSlot {
  id: string;
  name: string;
  sort_order: number;
}
