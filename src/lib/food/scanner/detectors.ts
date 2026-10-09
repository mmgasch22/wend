// Lectores de código de barras para el navegador.
//
// Dos motores, el mismo contrato:
//   - nativo (`BarcodeDetector`): rápido y preciso, pero solo existe en parte
//     de los navegadores (Chrome en Android; NO Safari en iPhone ni Firefox).
//   - ZXing (JavaScript puro): funciona en cualquier navegador con cámara.
//     Se descarga solo cuando hace falta (import dinámico): quien nunca abre
//     el escáner no paga su peso, y quien lo abre en un Chrome de Android
//     tampoco, porque usa el nativo.

import {
  LEGACY_SCHEDULE,
  passForAttempt,
  planPass,
  SCAN_SCHEDULE,
  type PassSpec,
} from "./analysis";
import { createLuminanceDecoder, rgbaToLuminance } from "./decodeLuminance";
import type { ScannerProfile } from "./camera";

// Datos técnicos del último intento, para el modo de diagnóstico.
export interface ReaderStats {
  pass: string;
  analyzedWidth: number;
  analyzedHeight: number;
  lastMs: number;
}

export interface BarcodeReader {
  readonly kind: "native" | "zxing";
  // Intenta leer UN código en el fotograma actual del vídeo. El número de
  // intento permite alternar la forma de analizar entre intentos.
  detect(video: HTMLVideoElement, attempt: number): Promise<string | null>;
  stats(): ReaderStats | null;
  dispose(): void;
}

// Solo formatos de producto de consumo: menos formatos = lecturas más
// rápidas y menos falsos positivos.
const NATIVE_FORMATS = ["ean_13", "ean_8", "upc_a"];

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
    let lastMs = 0;
    return {
      kind: "native",
      async detect(video) {
        const start = performance.now();
        const results = await detector.detect(video);
        lastMs = performance.now() - start;
        return results[0]?.rawValue ?? null;
      },
      stats: () => ({
        pass: "fotograma completo (nativo)",
        analyzedWidth: 0,
        analyzedHeight: 0,
        lastMs,
      }),
      dispose() {},
    };
  } catch {
    return null;
  }
}

function describePass(spec: PassSpec): string {
  return `${spec.region === "band" ? "franja" : "visible"} @${spec.maxWidth}`;
}

async function createZxingReader(profile: ScannerProfile): Promise<BarcodeReader> {
  const zxing = await import("@zxing/library");
  const decoder = createLuminanceDecoder(zxing);
  const schedule = profile === "anterior" ? LEGACY_SCHEDULE : SCAN_SCHEDULE;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { willReadFrequently: true });
  let luminance = new Uint8ClampedArray(0);
  let last: ReaderStats | null = null;

  return {
    kind: "zxing",
    async detect(video, attempt) {
      const { videoWidth, videoHeight } = video;
      if (!context || !videoWidth || !videoHeight) return null;

      const start = performance.now();
      const spec = passForAttempt(schedule, attempt);
      const plan = planPass(spec, videoWidth, videoHeight);

      canvas.width = plan.width;
      canvas.height = plan.height;
      context.drawImage(
        video,
        plan.region.sx,
        plan.region.sy,
        plan.region.sw,
        plan.region.sh,
        0,
        0,
        plan.width,
        plan.height,
      );

      const pixels = context.getImageData(0, 0, plan.width, plan.height).data;
      const size = plan.width * plan.height;
      if (luminance.length !== size) luminance = new Uint8ClampedArray(size);
      rgbaToLuminance(pixels, luminance);

      const text = decoder.decode(luminance, plan.width, plan.height);
      last = {
        pass: describePass(spec),
        analyzedWidth: plan.width,
        analyzedHeight: plan.height,
        lastMs: performance.now() - start,
      };
      return text;
    },
    stats: () => last,
    dispose() {
      decoder.dispose();
    },
  };
}

// Devuelve el mejor lector disponible. Si el nativo existe pero falla de
// forma repetida (pasa en algunos Android sin los servicios de Google), se
// cambia solo a ZXing en vez de quedarse "mirando" sin leer nada.
export async function createBarcodeReader(
  profile: ScannerProfile = "estandar",
): Promise<BarcodeReader> {
  const native = await createNativeReader();
  if (!native) return createZxingReader(profile);

  const MAX_NATIVE_FAILURES = 3;
  let failures = 0;
  let fallback: BarcodeReader | null = null;

  return {
    get kind() {
      return fallback ? "zxing" : "native";
    },
    async detect(video, attempt) {
      if (fallback) return fallback.detect(video, attempt);
      try {
        const code = await native.detect(video, attempt);
        failures = 0;
        return code;
      } catch {
        failures += 1;
        if (failures >= MAX_NATIVE_FAILURES) {
          fallback = await createZxingReader(profile);
        }
        return null;
      }
    },
    stats: () => (fallback ?? native).stats(),
    dispose() {
      native.dispose();
      fallback?.dispose();
    },
  };
}
