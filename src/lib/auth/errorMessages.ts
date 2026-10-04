interface AuthErrorLike {
  code?: string;
  message?: string;
}

const MESSAGES_BY_CODE: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed:
    "Todavía no has confirmado tu email. Revisa tu bandeja (y la carpeta de spam) o regístrate de nuevo para recibir otro enlace.",
  over_email_send_rate_limit:
    "Has pedido demasiados correos seguidos. Espera un minuto e inténtalo de nuevo.",
  over_request_rate_limit:
    "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
  weak_password: "La contraseña es demasiado débil. Usa al menos 6 caracteres.",
  same_password: "La nueva contraseña tiene que ser distinta de la anterior.",
  email_address_invalid: "Ese email no es válido.",
  user_already_exists: "Ya existe una cuenta con ese email.",
  email_exists: "Ya existe una cuenta con ese email.",
  signup_disabled: "El registro está desactivado ahora mismo.",
  otp_expired: "El enlace ha caducado. Pide uno nuevo.",
  unexpected_failure:
    "No se ha podido completar la acción (puede ser un fallo al enviar el email). Inténtalo de nuevo en unos minutos.",
};

const FALLBACK_MESSAGE = "No se ha podido completar la acción. Inténtalo de nuevo.";

// Supabase devuelve los errores de Auth en inglés. El `code` es el dato
// estable (el `message` puede cambiar entre versiones), así que se traduce
// por código; lo desconocido cae a un mensaje genérico en castellano.
export function authErrorMessage(error: AuthErrorLike): string {
  if (error.code && MESSAGES_BY_CODE[error.code]) {
    return MESSAGES_BY_CODE[error.code];
  }
  if (error.message && /error sending .*email/i.test(error.message)) {
    return MESSAGES_BY_CODE.unexpected_failure;
  }
  return FALLBACK_MESSAGE;
}
