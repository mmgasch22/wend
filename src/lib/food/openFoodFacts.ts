import type { FoodSearchResult } from "./types";

// Forma común a las dos APIs de búsqueda de OpenFoodFacts (la nueva,
// search-a-licious, devuelve `hits`; la antigua, `products`): mismos campos,
// salvo que `brands` es un array en la nueva y un texto en la antigua.
export interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string[] | string;
  nutriments?: {
    "energy-kcal_100g"?: number;
    proteins_100g?: number;
    carbohydrates_100g?: number;
    fat_100g?: number;
    fiber_100g?: number;
    sugars_100g?: number;
    salt_100g?: number;
  };
}

function brandsText(brands: OpenFoodFactsProduct["brands"]): string {
  if (!brands) return "";
  return Array.isArray(brands) ? brands.join(", ") : brands;
}

// Descarta lo que no sirve (sin nombre o sin kcal) y marca como
// `incomplete` lo que no trae algún macro — nunca se interpreta como 0.
export function mapOpenFoodFactsProduct(
  product: OpenFoodFactsProduct,
): FoodSearchResult | null {
  const kcal100g = product.nutriments?.["energy-kcal_100g"];
  if (!product.product_name || kcal100g === undefined) return null;

  const protein100g = product.nutriments?.proteins_100g ?? null;
  const carbs100g = product.nutriments?.carbohydrates_100g ?? null;
  const fat100g = product.nutriments?.fat_100g ?? null;
  const brands = brandsText(product.brands);

  return {
    id: null,
    barcode: product.code ?? null,
    name: brands ? `${product.product_name} (${brands})` : product.product_name,
    kcal100g,
    protein100g,
    carbs100g,
    fat100g,
    fiber100g: product.nutriments?.fiber_100g ?? null,
    sugar100g: product.nutriments?.sugars_100g ?? null,
    salt100g: product.nutriments?.salt_100g ?? null,
    incomplete: protein100g === null || carbs100g === null || fat100g === null,
  };
}

export function mapOpenFoodFactsProducts(
  products: OpenFoodFactsProduct[],
): FoodSearchResult[] {
  const seenBarcodes = new Set<string>();
  const results: FoodSearchResult[] = [];

  for (const product of products) {
    if (product.code) {
      if (seenBarcodes.has(product.code)) continue;
      seenBarcodes.add(product.code);
    }
    const mapped = mapOpenFoodFactsProduct(product);
    if (mapped) results.push(mapped);
  }

  return results;
}
