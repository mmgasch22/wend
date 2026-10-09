// Geometría de lo que "ve" el usuario frente a lo que analiza el lector.
//
// El vídeo se muestra recortado para llenar un recuadro con una proporción
// fija (`object-cover`). En un móvil en vertical el fotograma real es mucho
// más alto que lo que se ve en pantalla. Analizar todo el fotograma sería
// lento (cientos de miles de píxeles de más) y además leería cosas que el
// usuario ni está viendo: solo se analiza la zona visible.

export interface Region {
  sx: number;
  sy: number;
  sw: number;
  sh: number;
}

// Proporción ancho/alto del recuadro de la cámara en pantalla.
export const SCAN_VIEW_ASPECT_RATIO = 4 / 3;

// Zona del fotograma (en píxeles del vídeo) que queda visible al ajustarlo,
// centrado, a un recuadro con la proporción dada.
export function visibleRegion(
  videoWidth: number,
  videoHeight: number,
  viewAspect: number = SCAN_VIEW_ASPECT_RATIO,
): Region {
  const videoAspect = videoWidth / videoHeight;

  if (videoAspect > viewAspect) {
    // Vídeo más ancho que el recuadro: se recortan los lados.
    const sw = videoHeight * viewAspect;
    return { sx: (videoWidth - sw) / 2, sy: 0, sw, sh: videoHeight };
  }

  // Vídeo más alto (móvil en vertical): se recortan arriba y abajo.
  const sh = videoWidth / viewAspect;
  return { sx: 0, sy: (videoHeight - sh) / 2, sw: videoWidth, sh };
}

// Tamaño al que reducir una región para analizarla: nunca se amplía, y se
// mantiene la proporción.
export function fitToWidth(
  width: number,
  height: number,
  maxWidth: number,
): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
