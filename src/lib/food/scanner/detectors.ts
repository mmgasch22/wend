// Lectores de código de barras para el navegador.
//
// Dos motores, el mismo contrato:
//   - nativo (`BarcodeDetector`): rápido y preciso, pero solo existe en parte
//     de los navegadores (Chrome en Android; NO Safari en iPhone ni Firefox).
//   - ZXing (JavaScript puro): funciona en cualquier navegador con cámara.
//     Se descarga solo cuando hace falta (import dinámico): quien nunca abre
//     el escáner no paga su peso, y quien lo abre en un Chrome de Android
//     tampoco, porque usa el nativo.

import { fitToWidth, visibleRegion } from "./region";

export interface BarcodeReader {
  readonly kind: "native" | "zxing";
  // Intenta leer UN código en el fotograma actual del vídeo.
  detect(video: HTMLVideoElement): Promise<string | null>;
  dispose(): void;
}

// Solo formatos de producto de consumo: menos formatos = lecturas más
// rápidas y menos falsos positivos.
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a"];

// Ancho máximo de la zona que analiza ZXing. Con el código ocupando buena
// parte del recuadro, 640 px dan varios píxeles por barra; más resolución no
// mejora la lectura y sí ralentiza cada intento en móviles modestos.
const ZXING_MAX_FRAME_WIDTH = 640;

interface NativeDetector {
  detect(source: CanvasImageSource): Promise<{ rawValue: string }[]>;
}
interface NativeDetectorConstructor {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats(): Promise<string[]>;
}

async function createNativeReader(): Promise<BarcodeReader | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorConstructor })
    .BarcodeDetector;
  if (!Detector) return null;

  try {
    const supported = await Detector.getSupportedFormats();
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
    if (formats.length === 0) return null;

    const detector = new Detector({ formats });
    return {
      kind: "native",
      async detect(video) {
        const results = await detector.detect(video);
        return results[0]?.rawValue ?? null;
      },
      dispose() {},
    };
  } catch {
    return null;
  }
}

async function createZxingReader(): Promise<BarcodeReader> {
  const zxing = await import("@zxing/library");

  const hints = new Map<import("@zxing/library").DecodeHintType, unknown>();
  hints.set(zxing.DecodeHintType.POSSIBLE_FORMATS, [
    zxing.BarcodeFormat.EAN_13,
    zxing.BarcodeFormat.EAN_8,
    zxing.BarcodeFormat.UPC_A,
  ]);
  // Sin TRY_HARDER: ese modo prueba además el fotograma girado 90° y más
  // líneas de lectura, y duplica el coste de cada intento. El usuario ya
  // sostiene el código en horizontal, dentro del recuadro.

  // Se usa el lector de códigos 1D directamente (en vez de MultiFormatReader):
  // este escribe un `console.warn` en cada intento sin código, que son casi
  // todos. El resultado es el mismo.
  const reader = new zxing.MultiFormatOneDReader(hints);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });

  return {
    kind: "zxing",
    async detect(video) {
      const { videoWidth, videoHeight } = video;
      if (!context || !videoWidth || !videoHeight) return null;

      // Solo la zona que el usuario ve en pantalla, reducida.
      const region = visibleRegion(videoWidth, videoHeight);
      const size = fitToWidth(region.sw, region.sh, ZXING_MAX_FRAME_WIDTH);
      canvas.width = size.width;
      canvas.height = size.height;
      context.drawImage(
        video,
        region.sx,
        region.sy,
        region.sw,
        region.sh,
        0,
        0,
        size.width,
        size.height,
      );

      try {
        const source = new zxing.HTMLCanvasElementLuminanceSource(canvas);
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

// Devuelve el mejor lector disponible. Si el nativo existe pero falla de
// forma repetida (pasa en algunos Android sin los servicios de Google), se
// cambia solo a ZXing en vez de quedarse "mirando" sin leer nada.
export async function createBarcodeReader(): Promise<BarcodeReader> {
  const native = await createNativeReader();
  if (!native) return createZxingReader();

  const MAX_NATIVE_FAILURES = 3;
  let failures = 0;
  let fallback: BarcodeReader | null = null;

  return {
    get kind() {
      return fallback ? "zxing" : "native";
    },
    async detect(video) {
      if (fallback) return fallback.detect(video);
      try {
        const code = await native.detect(video);
        failures = 0;
        return code;
      } catch {
        failures += 1;
        if (failures >= MAX_NATIVE_FAILURES) {
          fallback = await createZxingReader();
        }
        return null;
      }
    },
    dispose() {
      native.dispose();
      fallback?.dispose();
    },
  };
}
