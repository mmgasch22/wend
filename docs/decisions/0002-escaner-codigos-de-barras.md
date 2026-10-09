# ADR 0002: Escáner de códigos de barras (V2)

## Estado

Aceptado e implementado. **Pendiente de pruebas con un móvil real** (ver el final).

## Contexto

Primera funcionalidad de la V2. La promesa de WEND es "menos tiempo registrando,
más tiempo viviendo": escribir el nombre de un producto envasado y elegir entre
resultados es lo más lento del registro diario. El escáner debe ser fiable antes
que vistoso, y no puede registrar nada que el usuario no haya comprobado.

Restricciones: web (Next.js en Vercel, HTTPS), sin servicios de pago ni claves
nuevas, Android e iPhone, y la base de datos de alimentos es OpenFoodFacts (OFF).

## Decisión

### Flujo

1. "Escanear código" junto al buscador en *Añadir alimento* (no desplaza la
   búsqueda por nombre).
2. La cámara se pide **solo al pulsar**, no antes.
3. Al leer un código válido se consulta `GET /api/food-barcode`.
4. Si hay producto, se muestra la ficha (nombre, marca, macros por 100 g y qué
   macros faltan). El usuario elige los gramos y pulsa "Registrar".
5. **Detectar un código nunca registra nada.**

Si no hay producto, el servicio falla, la cámara no está disponible o el código
está mal, hay una salida clara en cada caso (volver a escanear, escribir el
código, buscar por nombre, o crear el alimento asociándole el código) sin salir
de la comida que se estaba rellenando.

### Lectura del código

- Se usa el `BarcodeDetector` **nativo** cuando existe (Chrome en Android).
  Si falla tres veces seguidas se cambia solo a ZXing.
- Si no existe (Safari en iPhone, Firefox, escritorio) se usa **`@zxing/library`
  0.23.0** (Apache-2.0, publicada por última vez en abril de 2026), cargada con
  import dinámico: ~120 KB comprimidos que solo se descargan al abrir el
  escáner en un navegador sin lector nativo. La página en sí carga ~10 KB más.
- Solo EAN-13, EAN-8 y UPC-A, con el lector 1D directo (`MultiFormatOneDReader`).
  `MultiFormatReader` escribe un `console.warn` en cada intento sin código.
- Solo se analiza la **zona visible** del vídeo, reducida a 640 px de ancho, y
  sin `TRY_HARDER`. Medido: un intento sin código pasó de ~286 ms a ~15 ms
  (mediana, escritorio, modo desarrollo, fotograma vertical de 720×1280). En un
  móvil real será más lento, pero con margen.
- Un mismo código nunca provoca dos consultas: el bucle de lectura se detiene al
  entregar el primer código aceptable, solo hay una consulta en vuelo y el botón
  de registrar se desactiva mientras se envía.
- La cámara se libera al leer, cancelar, salir de la pantalla o si el sistema la
  interrumpe.

Alternativas descartadas:

| Opción | Motivo |
| --- | --- |
| Solo `BarcodeDetector` | No existe en Safari/iPhone ni Firefox. |
| `@zxing/browser` | Gestiona la cámara por su cuenta; se prefiere controlar el ciclo de vida del flujo y sus errores. |
| `barcode-detector` + `zxing-wasm` | Más preciso y activo, pero añade un binario WebAssembly que habría que alojar o descargar de un CDN. Sin poder probar en móvil real, se prefiere JavaScript puro. Candidato si la lectura en iPhone resulta floja. |
| `html5-qrcode` | Sin publicaciones desde 2023. |
| Quagga2 | No evaluada a fondo. |

### Consulta del producto

Orden: (1) tabla `foods` por código (catálogo compartido: rápido, y funciona
aunque OFF esté caído); (2) OFF API v2 `/api/v2/product/{código}`; (3) respaldo
por la búsqueda nueva (`q=code:{código}`) si la principal falla.

Se interpreta el **cuerpo** de la respuesta, no solo el código HTTP: un código
inexistente en OFF responde **HTTP 200 con `status: 0`**. Resultados posibles:
`found`, `not_found`, `insufficient_data` (existe pero sin nombre o sin
calorías), `unavailable` (fallo del servicio: no se afirma que no exista) e
`invalid_code`. El respaldo nunca devuelve `not_found`: un índice atrasado no
prueba que el producto no exista.

Los códigos se validan con el dígito de control GS1 y los UPC-A (12 dígitos) se
guardan como EAN-13 (anteponiendo `0`), igual que OFF.

### Base de datos

**Sin migraciones.** `foods.barcode` ya era `UNIQUE` y admite nulos.

Hallazgo de la auditoría: `foods` solo tiene políticas de `SELECT` e `INSERT`
(sin `UPDATE`) y `logFood` hacía `upsert` por `barcode`, que **fallaba con un
error de seguridad de la base de datos al registrar por segunda vez cualquier
producto ya guardado** (por cualquier usuario). Ahora se busca primero por
código, se inserta solo si no existe y, si dos peticiones coinciden y la segunda
choca con la restricción única (`23505`), se reutiliza la fila ganadora.

Alimento manual con código: si el código ya existe y el alimento es del propio
usuario se reutiliza; si es de otra persona o de OFF, el alimento se guarda sin
el código (es único en la tabla).

## Consecuencias y limitaciones conocidas

- El catálogo `foods` es compartido. Un alimento manual con código creado por una
  persona se mostrará a quien escanee ese código (con sus datos sin verificar).
  El usuario siempre ve los macros antes de registrar.
- Al registrar, el servidor se fía de los valores nutricionales que envía el
  cliente (diseño heredado de V1). Un usuario con malas intenciones podría
  "envenenar" el catálogo para un código. Mitigación futura: volver a consultar
  OFF en el servidor al registrar.
- La primera lectura de un producto tarda lo que tarde OFF (~3 s en las pruebas);
  las siguientes salen del catálogo propio (<0,5 s).
- OFF no tiene todos los productos (marcas blancas, producto fresco) y algunos no
  traen calorías: en ese caso se ofrece crearlos a mano. No se convierte kJ a kcal.
- La cantidad se introduce en gramos: no se usan raciones ni el peso del envase.
- Sin linterna ni zoom.

## Pruebas

Automatizadas (Vitest): validación y normalización de códigos, interpretación de
las respuestas de OFF (encontrado, incompleto, inexistente, sin datos, servicio
caído, cuerpo inesperado, respaldo), cálculo de cantidades y macros faltantes,
bucle de lectura (un solo código, descarte de lecturas dudosas, parada, sin
solapes), errores de cámara y geometría de la zona visible.

En navegador (con cámara simulada que emite el vídeo de un EAN-13 dibujado y
datos reales de OFF): ficha completa y vista previa, registro, segundo registro
del mismo producto desde el catálogo y desde la búsqueda, código inexistente y
alta manual con código, datos insuficientes, servicio caído y reintento, código
inválido, permiso de cámara denegado, cancelación y cámara interrumpida (la
cámara se libera), un solo envío con varios Intro seguidos, y ausencia de
desbordamiento horizontal a 320, 390 y 768 px.

**Pendiente con móvil real** (no se ha podido hacer): permiso y cámara en
iPhone (Safari) y Android (Chrome), enfoque y legibilidad de códigos reales
impresos (brillos, envases curvos, poca luz), velocidad del lector ZXing en un
móvil, y comportamiento al bloquear la pantalla o cambiar de aplicación a mitad
de un escaneo.
