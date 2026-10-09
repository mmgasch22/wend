import { describe, expect, it } from "vitest";
import { cameraProblemMessage, classifyCameraError, getCameraSupport } from "./camera";

describe("classifyCameraError", () => {
  it("permiso denegado", () => {
    expect(classifyCameraError({ name: "NotAllowedError" })).toBe("permission_denied");
    expect(classifyCameraError(new DOMException("denied", "NotAllowedError"))).toBe(
      "permission_denied",
    );
  });

  it("sin cámara", () => {
    expect(classifyCameraError({ name: "NotFoundError" })).toBe("no_camera");
    expect(classifyCameraError({ name: "OverconstrainedError" })).toBe("no_camera");
  });

  it("cámara ocupada o con fallo de hardware", () => {
    expect(classifyCameraError({ name: "NotReadableError" })).toBe("in_use");
    expect(classifyCameraError({ name: "AbortError" })).toBe("in_use");
  });

  it("contexto no seguro y navegador sin soporte", () => {
    expect(classifyCameraError({ name: "SecurityError" })).toBe("insecure");
    expect(classifyCameraError(new TypeError("mediaDevices is undefined"))).toBe("unsupported");
  });

  it("cualquier otra cosa es 'unknown' y nunca lanza", () => {
    expect(classifyCameraError(null)).toBe("unknown");
    expect(classifyCameraError(undefined)).toBe("unknown");
    expect(classifyCameraError("boom")).toBe("unknown");
    expect(classifyCameraError({})).toBe("unknown");
  });
});

describe("getCameraSupport", () => {
  const withCamera = { getUserMedia: () => Promise.resolve() };

  it("ok si la página es segura y existe getUserMedia", () => {
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: withCamera })).toBe("ok");
  });

  it("insecure si la página no es segura", () => {
    expect(getCameraSupport({ isSecureContext: false, mediaDevices: withCamera })).toBe("insecure");
  });

  it("unsupported si el navegador no expone la cámara", () => {
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: undefined })).toBe(
      "unsupported",
    );
    expect(getCameraSupport({ isSecureContext: true, mediaDevices: {} })).toBe("unsupported");
  });
});

describe("cameraProblemMessage", () => {
  it("todos los problemas tienen un mensaje comprensible en castellano", () => {
    const problems = [
      "permission_denied",
      "no_camera",
      "in_use",
      "insecure",
      "unsupported",
      "interrupted",
      "reader_failed",
      "unknown",
    ] as const;
    for (const problem of problems) {
      const message = cameraProblemMessage(problem);
      expect(message.length).toBeGreaterThan(10);
      expect(message).not.toMatch(/Error|undefined|DOMException/);
    }
  });
});
