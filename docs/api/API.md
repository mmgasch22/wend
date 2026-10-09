# API interna

Rutas de `src/app/api/`. Todas exigen sesión iniciada (si no, `401` con
`{"error":"No autenticado."}`).

## `GET /api/food-search?q={texto}`

Busca por nombre en tus alimentos manuales y en OpenFoodFacts (con respaldo si
falla). Devuelve `{ yourFoods, openFoodFacts, openFoodFactsUnavailable? }`.
Con menos de 2 caracteres devuelve listas vacías.

## `GET /api/food-barcode?code={código}`

Busca un producto por su código de barras. **No guarda nada.**

Orden de búsqueda: tabla `foods` (catálogo compartido) → OpenFoodFacts API v2 →
respaldo por la búsqueda nueva de OpenFoodFacts si la anterior falla (máx. 8 s
cada intento).

El código se valida (8, 12, 13 o 14 dígitos con dígito de control GS1) y se
normaliza: un UPC-A de 12 dígitos se convierte a EAN-13.

Respuesta (`BarcodeLookupResult`, ver `src/lib/food/types.ts`):

| `status` | HTTP | Significado |
| --- | --- | --- |
| `found` | 200 | Producto encontrado (`source`: `local` u `openfoodfacts`, y `food`). |
| `not_found` | 200 | El código no existe en OpenFoodFacts. |
| `insufficient_data` | 200 | Existe, pero sin nombre o sin calorías (`name` si lo hay). |
| `unavailable` | 200 | Falló el servicio: **no** se sabe si existe. |
| `invalid_code` | 400 | No es un código de barras válido. |

Nota sobre OpenFoodFacts: un código inexistente responde con HTTP 200 y
`status: 0`; por eso se interpreta el cuerpo y no solo el código HTTP.
