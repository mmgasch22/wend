// Mensaje que se muestra al usuario cuando falla una escritura en la base de
// datos. Los mensajes de Postgres/PostgREST revelan nombres de tablas,
// restricciones y columnas ("violates check constraint …"): no son útiles para
// la persona y sí para quien quiera sondear el esquema.
export const SAVE_ERROR = "No se pudo guardar. Inténtalo de nuevo en un momento.";
