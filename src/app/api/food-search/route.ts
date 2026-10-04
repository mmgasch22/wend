import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { FoodSearchResponse, FoodSearchResult } from "@/lib/food/types";
import {
  mapOpenFoodFactsProducts,
  type OpenFoodFactsProduct,
} from "@/lib/food/openFoodFacts";

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

const USER_AGENT = "WEND - Personal Nutrition App - Development";
const SEARCH_A_LICIOUS_URL = "https://search.openfoodfacts.org/search";
const LEGACY_SEARCH_URL = "https://world.openfoodfacts.org/cgi/search.pl";
const REQUEST_TIMEOUT_MS = 8000;

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

async function fetchJson(url: URL): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`OpenFoodFacts devolvió ${response.status}.`);
  }

  return response.json();
}

// La búsqueda antigua (cgi/search.pl) falla de forma intermitente con 503,
// así que se usa primero la API nueva (search-a-licious) y la antigua solo
// como respaldo. Si las dos fallan, se lanza el error: la ruta lo convierte
// en un aviso al usuario en vez de un engañoso "no hemos encontrado".
async function searchOpenFoodFacts(query: string): Promise<FoodSearchResult[]> {
  try {
    const url = new URL(SEARCH_A_LICIOUS_URL);
    url.searchParams.set("q", query);
    url.searchParams.set("page_size", "20");
    url.searchParams.set("fields", "code,product_name,brands,nutriments");
    const data = (await fetchJson(url)) as { hits?: OpenFoodFactsProduct[] };
    return mapOpenFoodFactsProducts(data.hits ?? []);
  } catch {
    const url = new URL(LEGACY_SEARCH_URL);
    url.searchParams.set("search_terms", query);
    url.searchParams.set("search_simple", "1");
    url.searchParams.set("action", "process");
    url.searchParams.set("json", "1");
    url.searchParams.set("page_size", "20");
    const data = (await fetchJson(url)) as { products?: OpenFoodFactsProduct[] };
    return mapOpenFoodFactsProducts(data.products ?? []);
  }
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
  const openFoodFactsUnavailable = openFoodFactsResult.status === "rejected";

  return NextResponse.json<FoodSearchResponse>({
    yourFoods,
    openFoodFacts,
    openFoodFactsUnavailable,
  });
}
