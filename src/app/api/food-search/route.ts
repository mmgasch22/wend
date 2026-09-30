import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodSearchResponse, FoodSearchResult } from "@/lib/food/types";

interface OpenFoodFactsProduct {
  code?: string;
  product_name?: string;
  brands?: string;
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

interface FoodRow {
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

const OPENFOODFACTS_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";

function isIncomplete(row: {
  protein_100g: number | null;
  carbs_100g: number | null;
  fat_100g: number | null;
}): boolean {
  return row.protein_100g === null || row.carbs_100g === null || row.fat_100g === null;
}

function fromFoodRow(row: FoodRow): FoodSearchResult {
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

async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  const url = new URL(OPENFOODFACTS_SEARCH_URL);
  url.searchParams.set("search_terms", query);
  url.searchParams.set("search_simple", "1");
  url.searchParams.set("action", "process");
  url.searchParams.set("json", "1");
  url.searchParams.set("page_size", "20");

  const response = await fetch(url, {
    headers: {
      "User-Agent": "WEND - Personal Nutrition App - Development",
    },
  });

  if (!response.ok) {
    throw new Error("OpenFoodFacts devolvió un error.");
  }

  const data = (await response.json()) as { products?: OpenFoodFactsProduct[] };
  const seenBarcodes = new Set<string>();
  const results: FoodSearchResult[] = [];

  for (const product of data.products ?? []) {
    const kcal100g = product.nutriments?.["energy-kcal_100g"];
    if (!product.product_name || kcal100g === undefined) continue;
    if (product.code) {
      if (seenBarcodes.has(product.code)) continue;
      seenBarcodes.add(product.code);
    }

    const protein100g = product.nutriments?.proteins_100g ?? null;
    const carbs100g = product.nutriments?.carbohydrates_100g ?? null;
    const fat100g = product.nutriments?.fat_100g ?? null;

    results.push({
      id: null,
      barcode: product.code ?? null,
      name: product.brands
        ? `${product.product_name} (${product.brands})`
        : product.product_name,
      kcal100g,
      protein100g,
      carbs100g,
      fat100g,
      fiber100g: product.nutriments?.fiber_100g ?? null,
      sugar100g: product.nutriments?.sugars_100g ?? null,
      salt100g: product.nutriments?.salt_100g ?? null,
      incomplete: isIncomplete({ protein_100g: protein100g, carbs_100g: carbs100g, fat_100g: fat100g }),
    });
  }

  return results;
}

// Proxy server-side a la Search API (legacy) de OpenFoodFacts, combinado
// con una búsqueda en tu propia tabla `foods` (solo tus alimentos
// manuales, vía created_by) para que se puedan reencontrar y reutilizar.
// Vive en un Route Handler (el primero del proyecto) en vez de una Server
// Action porque la búsqueda mientras se escribe necesita fetch cancelable
// con debounce desde el cliente.
export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("q")?.trim() ?? "";

  if (query.length < 2) {
    return NextResponse.json<FoodSearchResponse>({ yourFoods: [], openFoodFacts: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const [yourFoodsResult, openFoodFactsResult] = await Promise.allSettled([
    supabase
      .from("foods")
      .select(
        "id, barcode, name, kcal_100g, protein_100g, carbs_100g, fat_100g, fiber_100g, sugar_100g, salt_100g",
      )
      .eq("created_by", user.id)
      .ilike("name", `%${query}%`)
      .limit(10),
    searchOpenFoodFacts(query),
  ]);

  const yourFoods =
    yourFoodsResult.status === "fulfilled"
      ? ((yourFoodsResult.value.data ?? []) as FoodRow[]).map(fromFoodRow)
      : [];

  const openFoodFacts =
    openFoodFactsResult.status === "fulfilled" ? openFoodFactsResult.value : [];

  return NextResponse.json<FoodSearchResponse>({ yourFoods, openFoodFacts });
}
