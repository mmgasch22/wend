// Cuánto aporta una cantidad concreta de un alimento. Los valores se guardan
// "por 100 g": aquí se escalan a los gramos elegidos.

export interface Per100g {
  kcal100g: number;
  protein100g: number | null;
  carbs100g: number | null;
  fat100g: number | null;
}

export interface PortionNutrients {
  kcal: number;
  // null = el alimento no tiene ese dato. Nunca se convierte en 0: un macro
  // desconocido no es un macro que valga cero.
  protein: number | null;
  carbs: number | null;
  fat: number | null;
}

function scale(value100g: number | null, factor: number): number | null {
  return value100g === null ? null : Math.round(value100g * factor);
}

export function scaleNutrients(food: Per100g, grams: number): PortionNutrients | null {
  if (!Number.isFinite(grams) || grams <= 0) return null;

  const factor = grams / 100;
  return {
    kcal: Math.round(food.kcal100g * factor),
    protein: scale(food.protein100g, factor),
    carbs: scale(food.carbs100g, factor),
    fat: scale(food.fat100g, factor),
  };
}

export function formatMacroGrams(value: number | null): string {
  return value === null ? "— sin dato" : `${value} g`;
}

// Qué macros no tiene registrados el alimento, para decirlo con claridad en
// vez de dejar que parezca que valen cero.
export function missingMacroLabels(food: Per100g): string[] {
  const missing: string[] = [];
  if (food.protein100g === null) missing.push("proteína");
  if (food.carbs100g === null) missing.push("carbohidratos");
  if (food.fat100g === null) missing.push("grasa");
  return missing;
}

export function joinLabels(labels: string[]): string {
  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}`;
}
