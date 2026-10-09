import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { parseBarcode } from "@/lib/food/barcode";
import {
  interpretProductResponse,
  interpretSearchFallbackResponse,
} from "@/lib/food/barcodeLookup";
import { FOOD_SELECT_COLUMNS, fromFoodRow, type FoodRow } from "@/lib/food/foodRow";
import type { BarcodeLookupResult } from "@/lib/food/types";

const USER_AGENT = "WEND - Personal Nutrition App - Development";
const PRODUCT_URL = "https://world.openfoodfacts.org/api/v2/product";
const SEARCH_URL = "https://search.openfoodfacts.org/search";
const PRODUCT_FIELDS =
  "code,product_name,product_name_es,generic_name,brands,nutriments";
const REQUEST_TIMEOUT_MS = 8000;

// Pide una URL y devuelve el código HTTP y el cuerpo ya leído como JSON (o
// null si no era JSON). Un fallo de red o un timeout se propaga como error.
async function fetchJson(url: URL): Promise<{ status: number; body: unknown }> {
  const response = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }

  return { status: response.status, body };
}

async function lookupInOpenFoodFacts(barcode: string): Promise<BarcodeLookupResult> {
  try {
    const url = new URL(`${PRODUCT_URL}/${barcode}.json`);
    url.searchParams.set("fields", PRODUCT_FIELDS);
    const { status, body } = await fetchJson(url);
    const result = interpretProductResponse(barcode, status, body);
    if (result.status !== "unavailable") return result;
  } catch {
    // Red caída o timeout: se prueba el respaldo.
  }

  // La API principal ha fallado. El buscador nuevo es una infraestructura
  // distinta, así que a veces responde cuando la otra no.
  try {
    const url = new URL(SEARCH_URL);
    url.searchParams.set("q", `code:${barcode}`);
    url.searchParams.set("page_size", "1");
    url.searchParams.set("fields", "code,product_name,brands,nutriments");
    const { status, body } = await fetchJson(url);
    return interpretSearchFallbackResponse(barcode, status, body);
  } catch {
    return { status: "unavailable" };
  }
}

// Busca un producto por su código de barras. Primero en nuestra propia tabla
// `foods` (catálogo compartido: si alguien ya registró ese producto no hace
// falta preguntar fuera, y funciona aunque OpenFoodFacts esté caído) y, si no
// está, en OpenFoodFacts. NO guarda nada: solo devuelve lo encontrado para
// que el usuario lo confirme.
export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const parsed = parseBarcode(request.nextUrl.searchParams.get("code") ?? "");
  if (!parsed.ok) {
    return NextResponse.json<BarcodeLookupResult>(
      { status: "invalid_code" },
      { status: 400 },
    );
  }

  const barcode = parsed.code;

  const { data: row } = await supabase
    .from("foods")
    .select(FOOD_SELECT_COLUMNS)
    .eq("barcode", barcode)
    .maybeSingle();

  if (row) {
    return NextResponse.json<BarcodeLookupResult>({
      status: "found",
      source: "local",
      food: fromFoodRow(row as FoodRow),
    });
  }

  const result = await lookupInOpenFoodFacts(barcode);
  return NextResponse.json<BarcodeLookupResult>(result);
}
