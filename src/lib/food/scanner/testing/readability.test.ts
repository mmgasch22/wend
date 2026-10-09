import { describe, expect, it } from "vitest";
import * as zxing from "@zxing/library";
import { LEGACY_PASS, SCAN_SCHEDULE } from "../analysis";
import { createLuminanceDecoder } from "../decodeLuminance";
import {
  msPerEmptyAttempt,
  renderScenarioFrame,
  runPass,
  successRate,
  TEST_CODE,
  type Scenario,
} from "./readability";

// Pruebas de regresión de lectura con fotogramas SINTÉTICOS (sin cámara). Son
// rápidas y deterministas. Comprueban que el análisis nuevo lee a una distancia
// a la que el anterior fallaba, sin perder nada de cerca. NO demuestran cómo
// se comporta una cámara real: ver docs/scanner-distance.md.

const clean: Scenario = {
  name: "1080x1920 nítido",
  streamWidth: 1080,
  streamHeight: 1920,
  blurFraction: 0,
  noiseSigma: 3,
};

const decoder = createLuminanceDecoder(zxing);
const TRIALS = 6;

describe("lectura a distancia (sintético)", () => {
  it("a un 20 % del ancho el análisis anterior no lee y el nuevo sí", async () => {
    const legacy = await successRate(decoder, clean, [LEGACY_PASS], 0.2, TRIALS);
    const current = await successRate(decoder, clean, [...SCAN_SCHEDULE], 0.2, TRIALS);

    expect(legacy).toBeLessThanOrEqual(0.2);
    expect(current).toBeGreaterThanOrEqual(0.9);
  });

  it("de cerca (código grande) sigue leyendo igual de bien", async () => {
    for (const span of [0.35, 0.5, 0.65]) {
      const current = await successRate(decoder, clean, [...SCAN_SCHEDULE], span, TRIALS);
      expect(current).toBe(1);
    }
  });

  it("con poca resolución de cámara (720 px) no empeora respecto al anterior", async () => {
    const lowRes: Scenario = { ...clean, streamWidth: 720, streamHeight: 1280 };
    const legacy = await successRate(decoder, lowRes, [LEGACY_PASS], 0.23, TRIALS);
    const current = await successRate(decoder, lowRes, [...SCAN_SCHEDULE], 0.23, TRIALS);
    expect(current).toBeGreaterThanOrEqual(legacy);
  });

  it("un código demasiado pequeño no se lee, ni se inventa otro", async () => {
    const frame = renderScenarioFrame(clean, 0.05, 1);
    for (const pass of SCAN_SCHEDULE) {
      const read = await runPass(decoder, frame, clean.streamWidth, clean.streamHeight, pass);
      expect(read === null || read === TEST_CODE).toBe(true);
    }
    expect(await successRate(decoder, clean, [...SCAN_SCHEDULE], 0.05, TRIALS)).toBe(0);
  });

  it("un fotograma sin código no produce lecturas", async () => {
    const empty = new Uint8ClampedArray(1080 * 1920).fill(200);
    for (const pass of SCAN_SCHEDULE) {
      expect(await runPass(decoder, empty, 1080, 1920, pass)).toBeNull();
    }
  });

  it("leer un intento sin código es barato (no se vuelve lento por intentar leer lejos)", async () => {
    const ms = await msPerEmptyAttempt(clean, [...SCAN_SCHEDULE], decoder, 6);
    // Las tres pasadas juntas, en Node. Holgado a propósito: es un freno a
    // regresiones gordas, no una medida del móvil.
    expect(ms).toBeLessThan(150);
  });
});
