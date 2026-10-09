// Núcleo de lectura de ZXing sobre una imagen en escala de grises. Es lo que
// usa la app en el navegador y también las pruebas de lectura sin cámara, así
// que lo que se mide es lo que realmente se ejecuta.

type ZXing = typeof import("@zxing/library");

export interface LuminanceDecoder {
  // Devuelve el texto del código leído, o null si no hay ninguno legible.
  decode(luminance: Uint8ClampedArray, width: number, height: number): string | null;
  dispose(): void;
}

export function createLuminanceDecoder(zxing: ZXing): LuminanceDecoder {
  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>();
  // Solo formatos de producto de consumo: menos formatos = lecturas más
  // rápidas y menos falsos positivos.
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
    zxing.BarcodeFormat.UPC_A,
  ]);
  // Sin TRY_HARDER: ese modo prueba además el fotograma girado 90° y más
  // líneas de lectura, y duplica el coste de cada intento.

  // Lector de códigos 1D directo (en vez de MultiFormatReader): este escribe
  // un `console.warn` en cada intento sin código, que son casi todos.
  const reader = new zxing.MultiFormatOneDReader(hints);

  return {
    decode(luminance, width, height) {
      try {
        const source = new zxing.PlanarYUVLuminanceSource(
          luminance,
          width,
          height,
          0,
          0,
          width,
          height,
          false,
        );
        const bitmap = new zxing.BinaryBitmap(new zxing.HybridBinarizer(source));
        return reader.decode(bitmap, hints).getText();
      } catch {
        // "No hay ningún código en este fotograma" llega como excepción: es
        // lo normal en casi todos los intentos, no un error.
        return null;
      }
    },
    dispose() {
      reader.reset();
    },
  };
}

// RGBA (lo que devuelve un canvas) -> luminancia, con los mismos pesos que
// usa ZXing en su lector de canvas.
export function rgbaToLuminance(
  rgba: Uint8ClampedArray,
  out: Uint8ClampedArray = new Uint8ClampedArray(rgba.length / 4),
): Uint8ClampedArray {
  for (let i = 0, p = 0; i < rgba.length; i += 4, p++) {
    out[p] = (306 * rgba[i] + 601 * rgba[i + 1] + 117 * rgba[i + 2] + 0x200) >> 10;
  }
  return out;
}
