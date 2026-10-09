import { mapOpenFoodFactsProduct, type OpenFoodFactsProduct } from "./openFoodFacts";
import type { BarcodeLookupResult } from "./types";

// Lo que devuelve OpenFoodFacts al pedir un producto concreto por su código
// (API v2). Un código que no existe NO da un 404: da HTTP 200 con `status: 0`.
// Por eso el resultado se decide leyendo el cuerpo, no solo el código HTTP.
interface ProductResponseBody {
  status?: number | string;
  product?: OpenFoodFactsProduct & {
    product_name_es?: string;
    generic_name?: string;
  };
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function productName(product: NonNullable<ProductResponseBody["product"]>): string {
  return (
    product.product_name?.trim() ||
    product.product_name_es?.trim() ||
    product.generic_name?.trim() ||
    ""
  );
}

// Convierte la respuesta de OpenFoodFacts (código HTTP + cuerpo ya
// interpretado como JSON, o null si no lo era) en uno de los resultados que
// entiende la pantalla. Distingue explícitamente:
//   - not_found:         el código no existe en OpenFoodFacts.
//   - insufficient_data: existe, pero sin nombre o sin calorías: no se puede
//                        registrar sin inventar datos.
//   - unavailable:       el servicio falló; no sabemos si el producto existe.
export function interpretProductResponse(
  barcode: string,
  httpStatus: number,
  body: unknown,
): BarcodeLookupResult {
  const parsed = isObject(body) ? (body as ProductResponseBody) : null;

  if (httpStatus === 404 && parsed?.status === 0) {
    return { status: "not_found", barcode };
  }
  if (httpStatus < 200 || httpStatus >= 300 || parsed === null) {
    return { status: "unavailable" };
  }

  if (parsed.status === 0 || parsed.status === "0" || parsed.status === "failure") {
    return { status: "not_found", barcode };
  }
  if (!isObject(parsed.product)) {
    // 200 sin producto ni aviso de "no encontrado": respuesta inesperada, no
    // se puede afirmar que el producto no exista.
    return { status: "unavailable" };
  }

  const product = parsed.product as NonNullable<ProductResponseBody["product"]>;
  const name = productName(product);
  const mapped = mapOpenFoodFactsProduct({
    ...product,
    product_name: name,
    code: product.code ?? barcode,
  });

  if (!mapped) {
    return { status: "insufficient_data", barcode, name: name || null };
  }

  // Se guarda con el código escaneado (ya normalizado), no con el que
  // devuelva OpenFoodFacts: así la próxima lectura del mismo producto lo
  // reencuentra en nuestra base sin volver a consultar.
  return {
    status: "found",
    source: "openfoodfacts",
    food: { ...mapped, barcode },
  };
}

// Respuesta de la búsqueda nueva (search-a-licious) cuando se pregunta por un
// código concreto. Solo se usa como respaldo cuando la API principal falla,
// así que "sin resultados" aquí NO es una prueba de que el producto no exista
// (el índice puede ir por detrás): se devuelve `unavailable`.
export function interpretSearchFallbackResponse(
  barcode: string,
  httpStatus: number,
  body: unknown,
): BarcodeLookupResult {
  if (httpStatus < 200 || httpStatus >= 300 || !isObject(body)) {
    return { status: "unavailable" };
  }

  const hits = Array.isArray(body.hits) ? (body.hits as OpenFoodFactsProduct[]) : [];
  const hit = hits.find((candidate) => candidate.code === barcode);
  if (!hit) {
    return { status: "unavailable" };
  }

  const mapped = mapOpenFoodFactsProduct(hit);
  if (!mapped) {
    return { status: "insufficient_data", barcode, name: hit.product_name?.trim() || null };
  }

  return { status: "found", source: "openfoodfacts", food: { ...mapped, barcode } };
}
