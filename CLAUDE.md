@AGENTS.md

# Seguimiento del proyecto: Notion

WEND usa dos sistemas de registro con responsabilidades distintas:

- **GitHub / repositorio**: fuente de verdad del código y de la documentación técnica formal (ADRs en `docs/decisions/`, arquitectura, modelo de datos).
- **Notion**: fuente de verdad del estado del proyecto — roadmap, tareas, backlog, decisiones (resumidas) y seguimiento de sesiones de trabajo.

No dupliques documentación técnica completa en Notion. Notion es un resumen y un registro de seguimiento, no una copia del repo.

## Estructura de Notion a usar

Página raíz: **🚀 WEND**. Es un dashboard visual y minimalista — al abrirla debe poderse entender en 5 segundos: 🔥 qué está en marcha, ⏭️ qué toca después, 📍 en qué sprint/fase estamos, 📚 qué se ha aprendido, 💡 qué ideas hay. Evita texto largo y no dupliques ahí información que ya vive en las bases de datos o en el repo.

Dentro de ella:

- **🏃 Sprint Board** (base de datos, Kanban — el centro de operaciones): campos `Tarea` (nombres cortos y claros, ej. "Supabase Auth" no "Implementación de flujo completo de autenticación..."), `Estado` (Backlog / Todo / Doing / Review / Done, idealmente con prefijo emoji 🔴🟡🔵🟣🟢 — renombrar opciones de un campo Status requiere la UI de Notion, la API no lo soporta), `Sprint` (Sprint 0 / V1 / V2 / V3 / V4 / V5), `Prioridad` (P0-P3), `Notas`.
- **📋 Product Backlog** (base de datos, lista simple de cosas a construir algún día — no una segunda herramienta de gestión): campos `Nombre`, `Categoría`, `Prioridad`, `Sprint`, `Estado`, `Notas`. No rellenar dificultad/estimación/fecha (no existen como campos).
- **📝 Dev Journal** (base de datos): solo dos propiedades, `Entrada` y `Fecha`. Todo el resto del contenido de la sesión (hecho, aprendido, problemas, siguiente, decisiones) va como **contenido de la página**, no como propiedades, con este formato — omitiendo las secciones que no apliquen:
  ```
  ⏱️ Tiempo: ~X h
  ## ✅ Hecho
  - ...
  ## 🧠 Aprendido
  - ...
  ## 🐛 Problemas
  - ...
  ## ⏭️ Siguiente
  - ...
  ## 💡 Decisiones
  - ...
  ```
  El título de la página (`Entrada`) sigue el formato `🚀 Sesión — [fecha]`. El "Tiempo" se estima automáticamente a partir de la actividad de Git/sesión y se marca con `~` (aproximado); no pidas al usuario que lo rellene salvo que sea genuinamente necesario.
- **🗺️ Product Roadmap** (página): lista plana y visual de las grandes etapas (Sprint 0, Sprint 1... V2...), una línea por etapa. **Una etapa solo se marca ✅ cuando esa fase/sprint se ha cerrado de verdad y cumple sus objetivos — nunca automáticamente solo porque el código correspondiente esté terminado.** No inventes etapas futuras no definidas; dejarlas como "pendiente de definir".

**Convención de Sprint:** el campo `Sprint` (en Sprint Board y Product Backlog) solo tiene las opciones `Sprint 0, V1, V2, V3, V4, V5`. No añadas opciones nuevas. Las sub-fases dentro de V1 (Sprint 1 = Auth, Sprint 2 = Onboarding, etc.) se indican en el nombre de la tarea o en `Notas`, nunca como un valor nuevo de `Sprint`. En el Roadmap, en cambio, sí se usan como texto libre ("Sprint 1 — Auth") porque es contenido narrativo, no una propiedad estructurada.

Existe una sección **"Legacy (por ordenar o migrar)"** dentro de la página WEND con páginas duplicadas de una estructura anterior (Backlog, Ideas, Learning, UI, Bugs, Changelog antiguos). No escribas ni actualices nada ahí.

## Cuándo actualizar Notion

**Durante una sesión normal de desarrollo, NO actualices Notion después de cada cambio.** Solo se actualiza al cierre de sesión.

Interpreta como petición de cierre de sesión cualquiera de estas expresiones (o variantes claras de las mismas):

- "cerramos por hoy"
- "cerramos la sesión"
- "cerramos esta fase"
- "cerramos el sprint"
- "actualiza Notion"
- "paramos aquí"

## Qué hacer en el cierre de sesión

Hazlo automáticamente, sin pedir al usuario que rellene campos que puedas inferir de Git o de la propia conversación. Pregunta solo si algo es genuinamente ambiguo (p. ej. si una tarea nueva realmente forma parte del proyecto).

1. Revisa el estado real del repositorio y de Git (`git status`, `git log`, diffs) — no te fíes solo de lo dicho en la conversación.
2. Resume MUY brevemente qué se ha completado, qué está en progreso y qué queda pendiente (sin párrafos largos).
3. Actualiza el `Estado` (y `Prioridad` si aplica) de las tareas correspondientes en **Sprint Board** / **Product Backlog**, comprobando antes que trabajas sobre las bases correctas. No marques una tarea como `Done` si el código/tests/repo no lo demuestran. No crees tareas nuevas por pura inferencia si no está claro que forman parte real del proyecto — pregunta si hay ambigüedad.
4. Crea una entrada breve en **Dev Journal** con el formato visual descrito arriba (título `🚀 Sesión — [fecha]`, tiempo estimado con `~`, y solo las secciones que apliquen).
5. Actualiza **Product Roadmap** únicamente si una fase/sprint se ha cerrado de verdad en esta sesión — nunca solo porque el código esté terminado.
6. Si hubo una decisión técnica o de producto importante, resúmela en la sección "💡 Decisiones" de la entrada del Dev Journal. Si requiere documentación formal (ADR), indícalo y confirma que vive en el repo, no solo en Notion.
7. Deja claro el siguiente paso (sección "⏭️ Siguiente" de la entrada de Dev Journal).
8. No borres información histórica de Notion salvo que sea necesario para corregir un error — y en ese caso, dilo explícitamente.
9. No crees páginas o bases de datos nuevas si no son necesarias, y no dupliques documentación técnica del repositorio en Notion.
