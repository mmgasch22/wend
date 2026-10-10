# Changelog

## V2 (en desarrollo)

### Añadido
- Escáner de códigos de barras en *Añadir alimento*: lee EAN-13, EAN-8 y UPC-A
  con la cámara del móvil, consulta el producto, lo muestra para confirmarlo y
  lo registra con la cantidad elegida. Ver `docs/decisions/0002-escaner-codigos-de-barras.md`.
- `GET /api/food-barcode`: busca un producto por código (catálogo propio y
  OpenFoodFacts, con respaldo) y distingue producto inexistente, datos
  insuficientes y servicio caído.
- Entrada manual del código cuando la cámara no está disponible o no lo lee.
- Los alimentos creados a mano pueden llevar un código de barras asociado para
  reconocerlos la próxima vez.
- La ficha del producto muestra los macros por 100 g y nombra los que faltan.

- PWA mínima (rama `v2/pwa`): manifest, iconos provisionales, metadatos de iOS y
  `Cache-Control: private, no-store` en páginas y API. Sin service worker. Ver
  `docs/pwa.md`.
- Cabeceras de seguridad HTTP básicas (`nosniff`, `X-Frame-Options`, `Referrer-Policy`,
  `Permissions-Policy`).

### Corregido
- Registrar por segunda vez un producto con código ya guardado fallaba con un
  error de seguridad de la base de datos (`foods` no tiene política de `UPDATE`
  y se hacía un `upsert`). Ahora se reutiliza el producto existente.
- Los errores al guardar un alimento se muestran en castellano, no como mensajes
  técnicos de la base de datos.

## V1 — cerrada (2026-10-04)

Registro de alimentos, macros y calorías, agua, pasos, peso, estadísticas,
edición de objetivo y perfil, modo claro/oscuro, correos de confirmación y
recuperación de contraseña en castellano, desplegada en Vercel con Supabase.
