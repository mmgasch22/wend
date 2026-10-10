# Comprobación: ¿se borraron usuarios reales de Supabase?

Fecha de la comprobación: 2026-10-10. Solo lectura: no se ha borrado, modificado ni
restaurado nada.

## Qué se creyó

Al terminar una sesión de pruebas, una consulta de limpieza informó "4 usuarios
borrados, 10 restantes, 4 de ellos con aspecto de prueba". Se interpretó como que
la limpieza podía haber borrado cuentas reales o no haber borrado las de prueba.

## Conclusión

**No hay indicios de que se haya borrado ningún usuario real.** El "10 restantes" fue
un error de interpretación de la propia consulta (ver "Por qué salió 10").

## Evidencias

1. **Estado actual de `auth.users`:** exactamente 6 usuarios, con los mismos seis
   identificadores (prefijos `c85ebf0f`, `a0a904f9`, `005dc0b6`, `8852d033`,
   `4ccfedf8`, `fc325f1e`) que se listaron el 6 de octubre, antes de las pruebas
   del escáner y del registro. Ninguno cumple el patrón de las cuentas de prueba
   (`scantest*`, `legacytest*`, `wend.app.noreply+*`).
2. **Sus datos siguen ahí.** Por ejemplo, `a0a904f9` pasó de 7 a 13 comidas
   registradas (uso normal desde el 4 de octubre), y los seis tienen su alta de
   confirmación intacta.
3. **Contadores de PostgreSQL** (`pg_stat_all_tables`, esquema `auth`, tabla
   `users`): 6 borrados acumulados desde el último reinicio de estadísticas. Los
   borrados conocidos hechos desde sesiones de trabajo son exactamente seis:
   `prueba1` (1), `scantest` en la primera sesión de pruebas (1) y los cuatro de
   la última limpieza (`scantest`, `legacytest`, `reg1`, `reg2`). Cuadra al
   completo, sin ningún borrado sin explicar.

## Por qué salió "10 restantes"

La consulta era una sola sentencia con expresiones `WITH` que borraban filas
(`DELETE ... RETURNING`) y un `SELECT` final que contaba usuarios. En PostgreSQL,
todas las partes de una misma sentencia ven la tabla **tal como estaba antes de
empezar**: el recuento final contó los 4 usuarios que esa misma sentencia estaba
borrando. 6 reales + 4 de prueba = 10; y los "4 con aspecto de prueba" eran esos
mismos 4. El recuento correcto solo se obtiene en una consulta posterior (la de
esta comprobación).

## Lo que esta comprobación no puede demostrar

- Qué hacía cada usuario real antes del 6 de octubre más allá de lo listado aquí.
- Que ninguna otra persona con acceso al proyecto borrara algo: los contadores
  agregados no identifican quién.
- `auth.audit_log_entries` está vacía (0 filas), así que Supabase no guarda ahí un
  rastro de borrados en este proyecto.

## Comprobaciones recomendadas (si se quiere más certeza)

1. En el panel de Supabase → Authentication → Users, comparar a ojo la lista con
   las personas que se sabe que tienen cuenta.
2. Supabase → Database → Backups: en el plan gratuito solo hay copias diarias a
   modo de consulta; si se activa algún día el plan Pro conviene comprobar la
   política de recuperación.
3. Pedir a cada persona con cuenta real que confirme que puede entrar.
4. Para el futuro: **no mezclar borrados y recuentos en una misma sentencia**, y
   hacer las limpiezas de pruebas con identificadores exactos (nunca con patrones
   de correo que puedan coincidir con cuentas reales, como `wend.app.noreply+%`).

## Cambio de método

Las pruebas con cuentas temporales se hacen desde ahora así: se anotan los
identificadores creados, se borra únicamente por identificador exacto, y el
recuento de comprobación va en una consulta distinta y posterior.
