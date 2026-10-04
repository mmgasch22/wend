import { describe, expect, it } from "vitest";
import { authErrorMessage } from "./errorMessages";

describe("authErrorMessage", () => {
  it("traduce las credenciales incorrectas", () => {
    expect(authErrorMessage({ code: "invalid_credentials", message: "Invalid login credentials" })).toBe(
      "Email o contraseña incorrectos.",
    );
  });

  it("traduce el email sin confirmar e indica qué hacer", () => {
    expect(authErrorMessage({ code: "email_not_confirmed" })).toMatch(/confirmado tu email/);
  });

  it("traduce el límite de envíos de correo", () => {
    expect(
      authErrorMessage({
        code: "over_email_send_rate_limit",
        message: "For security purposes, you can only request this after 60 seconds.",
      }),
    ).toMatch(/Espera un minuto/);
  });

  it("reconoce el fallo de envío de email aunque no venga el código", () => {
    expect(authErrorMessage({ message: "Error sending confirmation email" })).toMatch(
      /enviar el email/,
    );
  });

  it("usa un mensaje genérico en castellano para errores desconocidos", () => {
    expect(authErrorMessage({ code: "algo_nuevo", message: "Some new english error" })).toBe(
      "No se ha podido completar la acción. Inténtalo de nuevo.",
    );
    expect(authErrorMessage({})).toBe("No se ha podido completar la acción. Inténtalo de nuevo.");
  });
});
