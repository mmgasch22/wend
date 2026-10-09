# Escáner: distancia de lectura

Estado: **mejora implementada, pendiente de confirmar con una prueba física.**
Un usuario real comprobó que la versión anterior solo leía "bastante cerca".
Este documento recoge qué limitaba la lectura, qué se ha cambiado, cómo se ha
medido y cómo repetir la comprobación con el mismo móvil.

## 1. Qué limitaba la distancia

La distancia máxima es proporcional a lo pequeño que puede ser el código dentro
del fotograma. Un lector 1D como ZXing necesita unos **2 píxeles por barra fina**
para leer; un EAN-13 tiene 95 módulos, así que hacen falta unos 190 px de ancho
de código en la imagen que *analiza el lector*.

Causas en la versión anterior (de más a menos peso):

| Causa | Efecto |
| --- | --- |
| **El análisis reducía todo el fotograma a 640 px** de ancho | Tope duro: sin importar la cámara, el código tenía que ocupar ~24-30 % del ancho. Es la causa principal. |
| Se pedía la cámara a **1280×720** (en vertical, 720 px de ancho) | Menos detalle disponible desde el origen. |
| **Sin zoom**, aunque el móvil lo tuviera | A la misma distancia, el código ocupa la mitad de píxeles que con 2×. |
| Se analizaba **todo el vídeo visible**, no solo donde el usuario pone el código | Más píxeles que procesar para el mismo resultado. |
| El enfoque continuo se pedía solo al abrir la cámara (a veces se ignora) | Posible desenfoque a media distancia en algunos móviles. |

Descartado como causa: el motor de lectura. Se midió `zxing-wasm` (el motor C++
de ZXing, ~420 KB comprimidos) con los mismos fotogramas y rinde prácticamente
igual que `@zxing/library` (~120 KB). No compensa.

No se puede medir sin el móvil: el enfoque automático real, los reflejos, la
curvatura del envase y qué cámara trasera elige el navegador (algunos móviles
tienen varias).

## 2. Qué se ha cambiado

1. **Captura**: se pide 1080p (ideal, nunca obligatorio) y cámara trasera.
2. **Capacidades reales** de la cámara (`track.getCapabilities()`): se aplica
   enfoque continuo si existe y **zoom 2× por defecto si el móvil lo ofrece**,
   con botones 1×/2×/3×/5× (solo los que admite) y se recuerda la elección. Si el
   móvil o navegador no expone zoom (frecuente en iPhone/Safari), no se muestra.
3. **Análisis**: una **franja central a todo el ancho** (la altura del recuadro
   guía), a resolución casi nativa, en lugar de todo el fotograma a 640 px. Cada
   intento alterna entre tres pasadas (franja a 1200 px, franja a 960 px, vídeo
   visible a 960 px) para no tener un solo punto débil, sin aumentar el coste de
   cada intento.
4. **Ayuda progresiva**: a los 4 s un consejo de distancia y enfoque; a los 8 s,
   de luz, reflejos, zoom y escribir el código.
5. **Diagnóstico** (`?diag=1` en la dirección): muestra cámara, resolución real,
   zoom, enfoque y tiempos. **Comparación** (`?scanner=anterior`): la versión
   anterior en la misma web, para comparar en el mismo móvil. Ambos son temporales
   para esta prueba.

Descartado a propósito: más resolución que 1080p (4K cuesta batería y CPU y el
lector apenas lo aprovecha), varias escalas en cada intento (triplicaría el coste),
selección automática de cámara por nombre (los nombres no son fiables) y linterna
(no pedida; se puede añadir si la prueba muestra problemas con poca luz).

## 3. Método de medida reproducible (sin cámara)

`src/lib/food/scanner/testing/`: genera fotogramas sintéticos de un EAN-13 con
tamaño, desenfoque y ruido controlados (semilla fija) y los pasa por el mismo
lector que usa la app. Para cada forma de analizar se busca la **fracción mínima
del ancho del fotograma que debe ocupar el código para leerse (≥ 90 % de
aciertos)**. Menos fracción = más distancia.

```bash
# Banco completo (minutos)
SCANNER_BENCH=1 SCANNER_BENCH_OUT=resultado.txt npx vitest run src/lib/food/scanner/testing/readability.bench.test.ts
# Regresión rápida (se ejecuta con `npm test`)
npx vitest run src/lib/food/scanner/testing/readability.test.ts
```

Resultados (flujo vertical 1080×1920, ruido ligero):

| Forma de analizar | Imagen nítida | Desenfoque suave | Desenfoque medio |
| --- | --- | --- | --- |
| Anterior (todo el vídeo a 640 px) | 23,5 % | 23,9 % | 31,5 % |
| Franja a 1200 px | 18,1 % | 18,6 % | 27,5 % |
| Franja a 960 px | 16,8 % | 21,3 % | 26,2 % |
| Vídeo visible a 960 px | 16,8 % | 21,7 % | 27,0 % |

Con un flujo de solo 720 px de ancho (móvil sin 1080p) la mejora es menor: 23,9 %
→ 20,8 %.

Misma comparación en el navegador (canvas + lector real + interfaz), con
desenfoque de 1,2 px y ruido: el análisis anterior lee desde ~30 % del ancho; el
nuevo, desde ~20 %. **Unos 1,5× más de distancia solo por el análisis.** El zoom
2× multiplica eso por 2 *si el móvil lo ofrece y la imagen sigue nítida*.

Traducción a centímetros (orientativa; EAN-13 de ~37 mm, campo de visión de unos
50° en vertical): el análisis anterior corta hacia 15-17 cm; el nuevo, hacia
22-25 cm; con zoom 2× efectivo, 40 cm o más. **Es una estimación del modelo, no
una medida real.**

Tiempo por intento: la lectura en sí cuesta 1-5 ms en un ordenador; el coste real
en un móvil está en copiar el fotograma al canvas (~15-35 ms medidos en
escritorio, modo desarrollo). Se mantienen ~5 intentos por segundo.

## 4. Lo que NO está demostrado

- Que un móvil real lea más lejos (esto es lo que falta).
- Cómo se comporta el enfoque a 2× y a distancias medias en cada móvil.
- El rendimiento de ZXing en móviles modestos.

## 5. Prueba física para confirmar (mismo móvil, mismo producto)

Preparación: pegar una cinta en la mesa con marcas a **10, 15, 20, 25, 30 y 35 cm**
del móvil. Misma luz y mismo producto en todas las pruebas.

1. Abre *Añadir alimento* y añade `&diag=1` al final de la dirección. Pulsa
   "Escanear código". Anota (o captura) el panel técnico: cámara, flujo, zoom,
   enfoque.
2. **Versión nueva**: para cada distancia, apoya el móvil en la marca, apunta al
   código y cuenta los segundos hasta que lee (máx. 5 s). Anota "lee / no lee".
3. **Versión anterior**: repite añadiendo `&scanner=anterior` a la dirección.
4. **De cerca** (8-10 cm, código grande): debería leer en menos de 1 s en ambas.
5. **Varios envases**: uno con código pequeño (chicle, yogur), uno grande (caja de
   cereales), uno curvo (lata, botella) y uno brillante (bolsa).
6. **Zoom y enfoque** (solo si aparecen los botones): prueba 1×, 2× y 3×. Anota si
   la imagen se ve nítida y si lee a más distancia con 2×.
7. **Cámara**: al cerrar el escáner, el indicador de cámara del móvil debe apagarse.

Plantilla de resultados:

| Distancia | Anterior | Nuevo (zoom por defecto) | Nuevo (1×) |
| --- | --- | --- | --- |
| 10 cm | | | |
| 15 cm | | | |
| 20 cm | | | |
| 25 cm | | | |
| 30 cm | | | |
| 35 cm | | | |

No se dará por resuelto hasta tener esta tabla del móvil real.
