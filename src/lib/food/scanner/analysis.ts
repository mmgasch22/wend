// Qué parte del fotograma se analiza y a qué tamaño. Funciones puras: se
// prueban sin cámara y se comparan entre sí con medidas.

import { fitToWidth, visibleRegion, type Region } from "./region";

// El recuadro guía que ve el usuario deja este margen respecto al vídeo
// visible. El análisis y el CSS comparten estos valores.
export const GUIDE_INSET_X = 0.1;
export const GUIDE_INSET_Y = 0.28;

export interface AnalysisPlan {
  region: Region;
  width: number;
  height: number;
}

// Franja horizontal central del vídeo visible: todo su ancho y la altura del
// recuadro guía. Un código de barras 1D se lee con unas pocas filas, así que
// basta una franja, y analizarla a resolución nativa cuesta menos que
// analizar todo el fotograma reducido.
//
// Se usa el ancho completo (y no solo el del recuadro) para que un código
// grande, de cerca, que sobresale un poco del recuadro, siga leyéndose.
export function guideBand(videoWidth: number, videoHeight: number): Region {
  const visible = visibleRegion(videoWidth, videoHeight);
  return {
    sx: visible.sx,
    sw: visible.sw,
    sy: visible.sy + visible.sh * GUIDE_INSET_Y,
    sh: visible.sh * (1 - 2 * GUIDE_INSET_Y),
  };
}

export const LEGACY_MAX_WIDTH = 640;

// Una pasada de análisis: qué zona del vídeo y a qué ancho máximo.
export interface PassSpec {
  region: "band" | "visible";
  maxWidth: number;
}

export function planPass(
  spec: PassSpec,
  videoWidth: number,
  videoHeight: number,
): AnalysisPlan {
  const region =
    spec.region === "band"
      ? guideBand(videoWidth, videoHeight)
      : visibleRegion(videoWidth, videoHeight);
  return { region, ...fitToWidth(region.sw, region.sh, spec.maxWidth) };
}

// Análisis de la versión anterior (todo el vídeo visible reducido a 640 px).
export const LEGACY_PASS: PassSpec = { region: "visible", maxWidth: LEGACY_MAX_WIDTH };

// Cada intento analiza el fotograma de una forma distinta, rotando entre estas
// pasadas (ver docs/scanner-distance.md, con las medidas):
//  1. franja central a 1200 px: la mejor con algo de desenfoque;
//  2. franja central a 960 px: promedia el ruido, la mejor en imagen nítida;
//  3. todo el vídeo visible a 960 px: red de seguridad si el código no está
//     centrado en vertical.
// Alternar (en vez de hacerlas todas en cada intento) mantiene el coste de un
// intento igual al de una sola pasada.
export const SCAN_SCHEDULE: readonly PassSpec[] = [
  { region: "band", maxWidth: 1200 },
  { region: "band", maxWidth: 960 },
  { region: "visible", maxWidth: 960 },
];

export const LEGACY_SCHEDULE: readonly PassSpec[] = [LEGACY_PASS];

export function passForAttempt(schedule: readonly PassSpec[], attempt: number): PassSpec {
  return schedule[((attempt % schedule.length) + schedule.length) % schedule.length];
}
