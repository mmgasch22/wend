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

// ---------------------------------------------------------------------------
// Ajustes de vídeo y capacidades reales de la cámara
// ---------------------------------------------------------------------------

// "estandar": la versión nueva. "anterior": la de antes de mejorar la distancia
// de lectura, que se conserva solo para poder comparar las dos en el mismo
// móvil (`?scanner=anterior` en la dirección). Se puede borrar después.
export type ScannerProfile = "estandar" | "anterior";

export function parseScannerProfile(value: string | null | undefined): ScannerProfile {
  return value === "anterior" ? "anterior" : "estandar";
}

// Cámara trasera y la mayor resolución razonable: 1080p. Todo es "ideal", no
// obligatorio: un móvil que no llegue a 1080p entrega lo más cercano que tenga
// en vez de fallar. Más resolución = más píxeles por barra a la misma
// distancia, que es lo que limita la lectura; 4K costaría batería y CPU sin
// mejorar lo que el lector aprovecha (ver docs/scanner-distance.md).
export function scannerVideoConstraints(profile: ScannerProfile): MediaStreamConstraints {
  const size =
    profile === "anterior"
      ? { width: { ideal: 1280 }, height: { ideal: 720 } }
      : { width: { ideal: 1920 }, height: { ideal: 1080 } };
  return {
    audio: false,
    video: { facingMode: { ideal: "environment" }, ...size },
  };
}

export interface ZoomRange {
  min: number;
  max: number;
  step: number;
}

export interface CameraCapabilities {
  zoom: ZoomRange | null;
  focusContinuous: boolean;
  torch: boolean;
}

interface ExtendedCapabilities {
  zoom?: { min?: number; max?: number; step?: number };
  focusMode?: string[];
  torch?: boolean;
}

// Lee lo que la cámara REAL dice que puede hacer. Zoom, enfoque y linterna no
// son estándar en todos los navegadores (Safari/iPhone y Firefox muchas veces
// no los exponen): si no están, simplemente no se ofrecen.
export function readCameraCapabilities(track: {
  getCapabilities?: () => unknown;
}): CameraCapabilities {
  let raw: ExtendedCapabilities = {};
  try {
    raw = (track.getCapabilities?.() ?? {}) as ExtendedCapabilities;
  } catch {
    raw = {};
  }

  const zoom =
    raw.zoom && typeof raw.zoom.max === "number" && typeof raw.zoom.min === "number"
      ? { min: raw.zoom.min, max: raw.zoom.max, step: raw.zoom.step ?? 0.1 }
      : null;

  return {
    zoom: zoom && zoom.max > zoom.min ? zoom : null,
    focusContinuous: Array.isArray(raw.focusMode) && raw.focusMode.includes("continuous"),
    torch: raw.torch === true,
  };
}

// Niveles de zoom que se ofrecen: solo los que el móvil admite, y solo si el
// rango sirve de algo (un máximo de 1,2x no cambia nada).
export function zoomPresets(range: ZoomRange | null): number[] {
  if (!range || range.max < 1.5) return [];
  const candidates = [1, 2, 3, 5];
  const presets = candidates.filter((z) => z >= range.min - 1e-9 && z <= range.max + 1e-9);
  return presets.length > 1 ? presets : [];
}

// Zoom con el que empieza el escáner: el último que eligió el usuario si el
// móvil lo admite; si no, 2x (el código ocupa el doble de píxeles a la misma
// distancia, que es justo lo que hace falta para leer desde más lejos).
export function initialZoom(range: ZoomRange | null, stored: number | null): number | null {
  const presets = zoomPresets(range);
  if (presets.length === 0) return null;
  if (stored !== null && presets.includes(stored)) return stored;
  return presets.includes(2) ? 2 : presets[presets.length - 1];
}

// Ayuda que se muestra cuando lleva un rato sin leer nada. Al principio no se
// dice nada (la instrucción fija ya está en pantalla); luego, consejos
// concretos y cortos, de lo más habitual a lo menos.
export function scanHint(elapsedMs: number, zoomAvailable: boolean): string | null {
  if (elapsedMs < 4000) return null;
  if (elapsedMs < 8000) {
    return "Mantén el móvil quieto y prueba a acercarte o alejarte un poco: tiene que enfocar.";
  }
  return zoomAvailable
    ? "Si sigue sin leer: más luz, otro ángulo (sin reflejos) o cambia el zoom. También puedes escribir el código."
    : "Si sigue sin leer: más luz, otro ángulo (sin reflejos) o escribe el código a mano.";
}
