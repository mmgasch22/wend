# WEND como app instalable (PWA)

Estado: implementación mínima en la rama `v2/pwa`, 2026-10-10. **Sin probar en un móvil
real**: solo comprobaciones automáticas (ver "Qué se ha comprobado").

## Qué es y qué no

Una PWA es una web que se puede "instalar" en la pantalla de inicio y se abre a pantalla
completa, como una app. **WEND sigue siendo la misma web**: necesita conexión, y no
guarda datos en el dispositivo para usarlos sin red.

## Qué se ha añadido

| Pieza | Dónde | Para qué |
| --- | --- | --- |
| Manifest (nombre WEND, `display: standalone`, colores, iconos, `start_url: /dashboard`) | `src/app/manifest.ts`, valores en `src/lib/pwa/config.ts` | Android/Chrome/Edge lo usan para instalar |
| Iconos 192, 512, *maskable* 512 y `apple-touch-icon` 180 | `public/icons/` | Icono en la pantalla de inicio. **Provisionales** (una "W" blanca sobre el color de marca): se regenerarán cuando decidas el logotipo |
| Metadatos de iOS (`apple-mobile-web-app-*`) y color de la barra | `src/app/layout.tsx` | iPhone ignora parte del manifest |
| `Cache-Control: private, no-store` en todo lo que no sea un recurso público estático | `next.config.ts` | Ver "Privacidad" |
| Cabeceras de seguridad (`nosniff`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy` con cámara solo en el propio origen) | `next.config.ts` | Barreras de bajo riesgo (ver `docs/privacidad/02`, hallazgo 10) |
| Pruebas automáticas | `src/lib/pwa/pwa.test.ts` | Manifest, existencia y tamaño real de los iconos, cabeceras |

**No hay service worker** (a propósito). Razones: no hace falta para instalar en iPhone
ni, hoy, para el diálogo de instalación de Chrome (verificar en el móvil); evita el
riesgo de guardar páginas con datos personales; evita una estrategia offline compleja
que no se pidió.

## Privacidad en la app instalada

- Todas las páginas y respuestas de la API llevan `private, no-store`: el navegador, la
  app instalada y cualquier proxy intermedio **no guardan copia**. Tras cerrar sesión,
  "Atrás" no vuelve a mostrar datos desde la caché.
- Los únicos recursos con caché son los públicos y sin datos personales: JS/CSS con hash
  (`/_next/static`), iconos y manifest.
- No hay almacenamiento offline de datos nutricionales.
- La sesión es la misma cookie de Supabase que en el navegador. En iOS, la app añadida a
  la pantalla de inicio tiene un almacenamiento separado del de Safari: **hay que
  iniciar sesión de nuevo dentro de la app instalada** (comportamiento de iOS, a
  confirmar en el móvil).
- Si algún día se añade un service worker, no debe interceptar `/dashboard`, `/api/*`,
  `/stats`, `/profile`, `/food` ni `/target`.

## Cámara/escáner en la app instalada

El escáner usa `getUserMedia`, que funciona en una PWA sobre HTTPS. En iOS el modo
independiente tuvo fallos de cámara en versiones antiguas; en iOS actuales debería
funcionar, **pero no se ha probado**. Es lo primero que hay que comprobar en el móvil.
La cabecera `Permissions-Policy: camera=(self)` autoriza la cámara solo para WEND.

## Cómo instalarla (cuando haya una versión desplegada con esta rama)

**iPhone (Safari; tiene que ser Safari)**

1. Abre la dirección de WEND en Safari.
2. Pulsa el botón Compartir (cuadrado con flecha).
3. "Añadir a pantalla de inicio" → "Añadir".
4. Abre WEND desde el icono nuevo. Inicia sesión (la sesión de Safari no se comparte).

**Android (Chrome)**

1. Abre la dirección de WEND en Chrome.
2. Menú ⋮ → "Instalar aplicación" (o "Añadir a pantalla de inicio").
3. Abre WEND desde el icono nuevo.

**Qué comprobar en el móvil, por orden**

1. Se abre sin barra del navegador y con el icono y nombre "WEND".
2. Iniciar sesión, cerrar la app, volver a abrirla: ¿sigue la sesión?
3. Escáner: ¿pide permiso de cámara y lee un código?
4. Cerrar sesión y pulsar "Atrás": no debe verse ningún dato.
5. Enlace del correo de confirmación/recuperación: ¿se abre en el navegador (normal) y,
   si se vuelve a la app instalada, hay que iniciar sesión? (Los enlaces de correo se
   abren en el navegador, no dentro de la app instalada.)

## Qué se ha comprobado (y qué no)

Comprobado en este equipo, con compilación de producción (`next build` + `next start`)
y `curl`:

- El manifest se sirve en `/manifest.webmanifest` con tipo `application/manifest+json`.
- La página incluye `<link rel="manifest">`, `theme-color` claro/oscuro,
  `apple-touch-icon` y las metaetiquetas de iOS.
- Las cabeceras de seguridad están en todas las respuestas; `no-store` en páginas y API y
  no en `/icons`, `/_next/static` ni el manifest.
- `/dashboard` sin sesión redirige a `/login`.
- 6 pruebas automáticas.

**No comprobado**: instalación en iPhone o Android reales, que el diálogo de instalación
aparezca en Chrome, comportamiento de la cámara y de la sesión en modo independiente,
auditoría de Lighthouse.

## Qué desplegaría una versión de prueba

Nada se ha subido ni desplegado. Si lo autorizas, hay dos opciones:

1. **Vista previa de Vercel de la rama** (recomendada): subir la rama `v2/pwa` a GitHub
   (`git push origin v2/pwa`). Vercel crea una URL de vista previa, sin tocar producción.
   Contendría **lo que hay en la rama**: el escáner con mejoras de distancia (commit
   `4d8bd8b`, aún no subido), la PWA y las cabeceras. **No** incluiría el onboarding
   nuevo (está en otra rama). Se conectaría a la **misma base de datos de producción**
   (mismas variables de entorno) y por tanto a los mismos usuarios reales: no se deben
   crear datos de prueba ahí sin que lo decidas. Dos cautelas: (a) las vistas previas
   suelen estar protegidas por el inicio de sesión de Vercel, así que desde el móvil
   habría que iniciar sesión en Vercel o desactivar esa protección para la prueba;
   (b) los enlaces de confirmación de correo apuntan al dominio desde el que se
   registró la persona.
2. **Probar en tu red local** con `npm run build && npm start` y abrir la IP del
   ordenador desde el móvil. Sin HTTPS no se pueden instalar PWA ni usar la cámara
   (salvo `localhost`), así que no sirve para probar esto.

Decisión pendiente: ¿autorizas subir la rama `v2/pwa` para generar la vista previa?
