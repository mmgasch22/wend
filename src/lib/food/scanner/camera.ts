// Estado y errores de la cámara, traducidos a algo que el usuario entienda.
// Los nombres de error son los estándar de getUserMedia (DOMException.name).

export type CameraProblem =
  | "permission_denied"
  | "no_camera"
  | "in_use"
  | "insecure"
  | "unsupported"
  | "interrupted"
  | "reader_failed"
  | "unknown";

export function classifyCameraError(error: unknown): CameraProblem {
  const name =
    typeof error === "object" && error !== null && "name" in error
      ? String((error as { name: unknown }).name)
      : "";

  switch (name) {
    case "NotAllowedError":
    case "PermissionDeniedError":
      return "permission_denied";
    case "NotFoundError":
    case "DevicesNotFoundError":
    case "OverconstrainedError":
      return "no_camera";
    case "NotReadableError":
    case "TrackStartError":
    case "AbortError":
      return "in_use";
    case "SecurityError":
      return "insecure";
    case "TypeError":
      return "unsupported";
    default:
      return "unknown";
  }
}

interface CameraEnvironment {
  isSecureContext?: boolean;
  mediaDevices?: { getUserMedia?: unknown } | null;
}

// Comprueba, sin pedir permiso, si este navegador puede abrir una cámara.
// La cámara solo está disponible en páginas seguras (https o localhost).
export function getCameraSupport(env: CameraEnvironment): "ok" | "insecure" | "unsupported" {
  if (env.isSecureContext === false) return "insecure";
  if (!env.mediaDevices || typeof env.mediaDevices.getUserMedia !== "function") {
    return "unsupported";
  }
  return "ok";
}

// Texto para el usuario: qué ha pasado y qué puede hacer. Sin jerga técnica.
export function cameraProblemMessage(problem: CameraProblem): string {
  switch (problem) {
    case "permission_denied":
      return "No tenemos permiso para usar la cámara. Puedes activarlo en los ajustes del navegador, o escribir el código a mano.";
    case "no_camera":
      return "No hemos encontrado ninguna cámara en este dispositivo.";
    case "in_use":
      return "No se ha podido abrir la cámara. Puede que otra aplicación la esté usando.";
    case "insecure":
      return "La cámara solo funciona en conexiones seguras (https).";
    case "unsupported":
      return "Este navegador no permite usar la cámara desde la web.";
    case "interrupted":
      return "La cámara se ha detenido. Vuelve a intentarlo.";
    case "reader_failed":
      return "No se ha podido cargar el lector de códigos. Comprueba tu conexión y vuelve a intentarlo.";
    case "unknown":
      return "No se ha podido abrir la cámara.";
  }
}

// Ajustes de vídeo pensados para leer códigos: cámara trasera, resolución
// suficiente para ver las barras y enfoque continuo cuando el móvil lo ofrece
// (`advanced` es opcional: si no lo soporta se ignora, no da error).
export const SCANNER_VIDEO_CONSTRAINTS: MediaStreamConstraints = {
  audio: false,
  video: {
    facingMode: { ideal: "environment" },
    width: { ideal: 1280 },
    height: { ideal: 720 },
    advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet],
  },
};
