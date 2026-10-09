// Método de medida de la distancia de lectura SIN cámara y reproducible.
//
// Idea: la distancia máxima a la que se lee un código es proporcional a lo
// pequeño que puede ser el código dentro del fotograma. Así que se busca la
// fracción mínima del ancho del fotograma que debe ocupar el código para que
// se lea, para cada forma de analizar la imagen. Menos fracción = más distancia.
//
//   distancia ∝ 1 / fracción mínima
//
// Limitaciones (importantes): es un modelo. Representa bien la resolución, el
// ruido y el desenfoque, pero NO el enfoque automático real, los reflejos, la
// curvatura del envase ni cómo procesa la imagen cada móvil. No sustituye a una
// prueba con cámara real: sirve para comparar dos formas de analizar la misma
// imagen y para detectar regresiones.

import { planPass, type PassSpec } from "../analysis";
import { createLuminanceDecoder } from "../decodeLuminance";
import {
  cropLuminance,
  renderFrame,
  resizeLuminance,
  seededRandom,
} from "./syntheticFrames";

export const TEST_CODE = "3017620422003";

// Cualquier lector que reciba luminancia: el de la app (síncrono) o uno
// candidato (asíncrono). Así se comparan con los mismos fotogramas.
export interface BenchDecoder {
  decode(luminance: Uint8ClampedArray, width: number, height: number): string | null | Promise<string | null>;
  dispose(): void;
}

export interface Scenario {
  name: string;
  // Tamaño del flujo de vídeo que entrega la cámara (móvil en vertical).
  streamWidth: number;
  streamHeight: number;
  // Desenfoque óptico como fracción del ancho del flujo (es un ángulo: con más
  // píxeles, el mismo desenfoque ocupa más píxeles).
  blurFraction: number;
  noiseSigma: number;
}

// Una pasada = un recorte y un tamaño de análisis concretos.
export async function runPass(
  decoder: BenchDecoder,
  frame: Uint8ClampedArray,
  frameWidth: number,
  frameHeight: number,
  kind: PassSpec,
): Promise<string | null> {
  const plan = planPass(kind, frameWidth, frameHeight);
  const cropped = cropLuminance(frame, frameWidth, plan.region);
  const data = resizeLuminance(
    cropped.data,
    cropped.width,
    cropped.height,
    plan.width,
    plan.height,
  );
  return await decoder.decode(data, plan.width, plan.height);
}

export function renderScenarioFrame(
  scenario: Scenario,
  spanFraction: number,
  seed: number,
): Uint8ClampedArray {
  const random = seededRandom(seed * 7919);
  const codeWidthPx = spanFraction * scenario.streamWidth;
  const modulePx = codeWidthPx / 95;
  // El código nunca está exactamente centrado: se desplaza un poco.
  const jitterX = (random() - 0.5) * 0.06 * scenario.streamWidth;
  const jitterY = (random() - 0.5) * 0.05 * scenario.streamHeight;
  return renderFrame({
    width: scenario.streamWidth,
    height: scenario.streamHeight,
    code: TEST_CODE,
    modulePx,
    centerX: scenario.streamWidth / 2 + jitterX,
    centerY: scenario.streamHeight / 2 + jitterY,
    codeHeightPx: codeWidthPx * 0.7,
    blurSigmaPx: scenario.blurFraction * scenario.streamWidth,
    noiseSigma: scenario.noiseSigma,
    seed,
  });
}

export async function successRate(
  decoder: BenchDecoder,
  scenario: Scenario,
  kinds: PassSpec[],
  spanFraction: number,
  trials: number,
): Promise<number> {
  let ok = 0;
  for (let t = 1; t <= trials; t++) {
    const frame = renderScenarioFrame(scenario, spanFraction, t);
    let read = false;
    for (const kind of kinds) {
      if ((await runPass(decoder, frame, scenario.streamWidth, scenario.streamHeight, kind)) === TEST_CODE) {
        read = true;
        break;
      }
    }
    if (read) ok++;
  }
  return ok / trials;
}

// Fracción mínima del ancho a la que se lee con >= `required` de aciertos.
// Búsqueda por bisección entre `high` (se lee seguro) y `low`.
export async function minSpanFraction(
  scenario: Scenario,
  kinds: PassSpec[],
  decoder: BenchDecoder,
  options: { trials?: number; required?: number; steps?: number } = {},
): Promise<number> {
  const { trials = 8, required = 0.9, steps = 7 } = options;
  let high = 0.6;
  let low = 0.03;
  if ((await successRate(decoder, scenario, kinds, high, trials)) < required) {
    return Number.NaN; // ni siquiera de cerca se lee: escenario imposible
  }
  for (let i = 0; i < steps; i++) {
    const mid = (high + low) / 2;
    if ((await successRate(decoder, scenario, kinds, mid, trials)) >= required) high = mid;
    else low = mid;
  }
  return high;
}

// Tiempo medio (ms) de LEER un fotograma sin código, que es el caso más
// habitual (casi todos los intentos). Se prepara antes el recorte y el
// reescalado y solo se cronometra la lectura: en el navegador ese reescalado
// lo hace el canvas, no JavaScript.
export async function msPerEmptyAttempt(
  scenario: Scenario,
  kinds: PassSpec[],
  decoder: BenchDecoder,
  repeats = 12,
): Promise<number> {
  const frame = renderScenarioFrame(scenario, 0.04, 1); // código diminuto: no se lee
  const prepared = kinds.map((kind) => {
    const plan = planPass(kind, scenario.streamWidth, scenario.streamHeight);
    const cropped = cropLuminance(frame, scenario.streamWidth, plan.region);
    return {
      data: resizeLuminance(cropped.data, cropped.width, cropped.height, plan.width, plan.height),
      width: plan.width,
      height: plan.height,
    };
  });
  for (const p of prepared) await decoder.decode(p.data, p.width, p.height);
  const start = performance.now();
  for (let i = 0; i < repeats; i++) {
    for (const p of prepared) await decoder.decode(p.data, p.width, p.height);
  }
  return (performance.now() - start) / repeats;
}

export function zxingJsDecoder(zxing: typeof import("@zxing/library")): BenchDecoder {
  return createLuminanceDecoder(zxing);
}
