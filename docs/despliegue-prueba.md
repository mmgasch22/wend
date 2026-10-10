# Versión de prueba en el móvil: plan de despliegue (sin ejecutar)

Estado: **plan, 2026-10-10. No se ha hecho push ni despliegue.** Esperando tu autorización.

## 1. Qué se desplegaría

- **Rama:** `v2/prueba-movil` (integración local de ramas ya probadas). Commit exacto: se
  indica en el informe de cierre (`git rev-parse v2/prueba-movil`).
- **Composición**, partiendo de `main`:

| Incluye | De dónde | Notas |
| --- | --- | --- |
| Escáner de códigos con la mejora de distancia | `main` (commit `4d8bd8b`, aún sin subir) | **Pendiente de tu prueba física** |
| PWA mínima (manifest, iconos provisionales, metadatos iOS, `no-store`, cabeceras) | `v2/pwa` | Sin service worker |
| Descarga de datos (JSON/CSV) en *Editar perfil* | `v2/exportar-datos` | Corregida contra el esquema real |
| Errores sin detalles de la base de datos al guardar perfil/objetivo | `v2/seguridad-local` | |
| Arreglo de tiempo de una prueba del escáner | `main` | Solo tests |
| **No incluye** | | Registro/onboarding nuevo, consentimientos, borrado de cuenta, cambios SQL |

- Comprobado en esa rama: `tsc`, `eslint`, 194 pruebas, `next build`, y la PWA servida en
  local (manifest, 3 iconos, `apple-touch-icon`, `theme-color`, cabeceras).

## 2. ¿Usaría la base de datos real?

**Hay que asumir que sí.** No he podido comprobarlo: la integración de Vercel no tiene
acceso a tu cuenta (error 403 de ámbito), así que no puedo leer la configuración del
proyecto. Si las variables `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
están en "All Environments" (lo habitual si las añadiste sin elegir entorno), una vista previa
usará la **base de producción**: tus 6 cuentas reales.

**Compruébalo tú** (1 minuto): Vercel → proyecto `wend` → Settings → Environment Variables:
mira si esas variables tienen marcado *Preview*.

## 3. Quién podría entrar a la versión de prueba

Dos capas distintas:

1. **Vercel Deployment Protection** (acceso a la URL de previsualización). **No he podido
   verificar su estado.** Si "Vercel Authentication" está activada para previews, solo entra
   quien haya iniciado sesión en tu cuenta de Vercel. Compruébalo en Settings → Deployment
   Protection.
2. **El login de WEND**. Es insuficiente como control de acceso: **el registro está abierto**.
   Si la URL se filtrara y la vista previa apuntara a la base real, cualquiera podría crear
   una cuenta nueva **en tu base de producción** (y se enviaría correo desde tu Gmail).

**Fricción esperada con Vercel Authentication y la PWA:** en iPhone, la app añadida a la
pantalla de inicio tiene un almacenamiento aparte de Safari; la sesión de Vercel de Safari
podría no estar en la app instalada, y se pediría iniciar sesión en Vercel dentro de ella.
No lo he probado: es una incógnita real para decidir la opción.

## 4. Riesgos para los datos reales (si se usa la base real)

| Riesgo | Probabilidad | Impacto | Mitigación |
| --- | --- | --- | --- |
| La vista previa escribe datos de prueba en la cuenta real de quien entre | Alta si entras con tu cuenta | Bajo (tuyos) | Usar una cuenta que no sea la principal, o asumirlo |
| El escáner crea alimentos en el catálogo común (`foods`) | Alta | Bajo (14 alimentos hoy) | Es el comportamiento normal de V2 |
| Cualquiera con la URL se registra en producción | Baja con Vercel Authentication; **alta si está desactivada** | Medio: ruido en `auth.users` y correos | Comprobar 3 (arriba) o aislar con la opción B |
| Un fallo del código estropea datos de tus cuentas | Muy baja (cambios de solo lectura + escáner ya probado en pruebas) | Alto: **sin copias** en el plan gratuito | Exportar tus datos antes (botón nuevo) y una copia con `supabase db dump` |
| Se despliega por error a producción | Nulo si **solo** se sube `v2/prueba-movil` y no `main` | Medio | Ver 6 |

## 5. Opciones

| Opción | Qué es | Datos reales | Coste | Pros / contras |
| --- | --- | --- | --- | --- |
| **A. Vista previa sobre la base real** | Subir la rama; Vercel crea una URL de previsualización | Sí | 0 | Rápida; depende de la protección de Vercel; fricción con la PWA; mezcla pruebas y datos reales |
| **B. Vista previa + proyecto de Supabase de pruebas (recomendada)** | Crear un segundo proyecto gratuito de Supabase con el mismo esquema; la vista previa usa ese | **No** | 0 (el plan gratuito permite 2 proyectos activos: **sin verificar para tu cuenta**) | Aislada; cuentas y correos de prueba; algo más de trabajo; los enlaces de correo exigen añadir la URL a la lista de redirecciones **del proyecto de pruebas** (no de producción) |
| **C. Producción** | Fusionar a `main` y subir | Sí | 0 | Es lo que necesitas para usar WEND cada día. **Aún no:** primero tu prueba del escáner y los textos legales |

**Recomendación:** B ahora para probar instalación, cámara y sesión; C después, cuando
confirmes el escáner y decidas el registro/consentimientos (`docs/privacidad/07`), sobre
todo si vas a invitar a amigos.

Para B necesitaría: tu autorización para crear el proyecto de pruebas (el MCP de Supabase
pide confirmar el coste, que debería ser 0) y para poner variables de entorno **solo en el
entorno Preview** de Vercel. Yo aplicaría las migraciones `0001`–`0003` (ya existentes) en
ese proyecto, **no** en producción.

## 6. Cómo asegurarme de no tocar producción

- Subir **solo** la rama `v2/prueba-movil`: `git push origin v2/prueba-movil`. Un push a
  una rama distinta de `main` no actualiza el dominio de producción (Vercel crea una vista
  previa). **Este comportamiento es el estándar de Vercel; no he podido verificar los ajustes
  de tu proyecto** (por ejemplo, la rama de producción configurada).
- No fusionar nada a `main` ni subir `main` hasta tu autorización.
- Después de subir, comprobar en la lista de despliegues que el de la rama dice "Preview" y
  que el de producción conserva su fecha.

## 7. Pruebas a hacer cuando haya una URL accesible

Orden y qué cuenta como éxito (**las haces tú en el móvil; yo no las he hecho**):

| # | Prueba | Éxito |
| --- | --- | --- |
| 1 | iPhone, Safari: Compartir → Añadir a pantalla de inicio | Aparece icono "W" y nombre "WEND" |
| 2 | Abrir desde el icono | Sin barra del navegador (modo aplicación) |
| 3 | Android, Chrome: menú ⋮ → Instalar aplicación | Igual que 1 y 2 |
| 4 | Iniciar sesión, cerrar la app del multitarea, reabrir | La sesión sigue |
| 5 | Cerrar sesión y pulsar "Atrás" | No se ve ningún dato privado |
| 6 | Abrir una URL privada sin sesión (por ejemplo `/dashboard`) | Redirige a `/login` |
| 7 | Escáner: *Añadir alimento → Escanear* | Pide permiso de cámara y lee un código; probar a distinto alcance (ver `docs/scanner-distance.md`) |
| 8 | Editar perfil → Tus datos → descargar JSON y CSV de comidas | Se descargan archivos con tus datos (comprueba que son tuyos y están completos) |
| 9 | Modo avión con la app abierta | Ver sección 8 |

## 8. Sin conexión: qué funciona

**WEND necesita internet para todo.** No hay service worker ni datos guardados en el
dispositivo, deliberadamente, para no dejar datos de salud en caché (ver `docs/pwa.md`).

| Función | Sin conexión |
| --- | --- |
| Abrir la app instalada | El sistema muestra su error de red (página en blanco o aviso del navegador) |
| Ver el dashboard, estadísticas, perfil | No (se cargan desde el servidor) |
| Registrar comidas, peso, agua, pasos | No |
| Escáner (cámara) | La cámara sí arranca; **la consulta del producto no** |
| Preferencias de tema y zoom | Se guardan en el dispositivo, pero la pantalla no carga |
| Iniciar o cerrar sesión | No |

Una versión con modo sin conexión (cola de registros pendientes) es una decisión de
producto posterior: implica guardar datos personales en el dispositivo.

## 9. Qué necesito que me digas

1. ¿A (rápido), B (aislada, recomendada) o esperar a C?
2. Si B: ¿autorizas crear el proyecto de pruebas en Supabase y las variables solo en
   *Preview* de Vercel?
3. ¿Autorizas `git push origin v2/prueba-movil`? (No se hace nada hasta entonces.)
