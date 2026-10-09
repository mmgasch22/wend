import { writeFileSync } from "node:fs";
import { describe, it } from "vitest";
import * as zxing from "@zxing/library";
import { LEGACY_PASS, type PassSpec } from "../analysis";
import {
  minSpanFraction,
  msPerEmptyAttempt,
  zxingJsDecoder,
  type BenchDecoder,
  type Scenario,
} from "./readability";

// Banco de medidas. Es lento a propósito (minutos), así que solo se ejecuta si
// se pide:
//
//   SCANNER_BENCH=1 SCANNER_BENCH_OUT=resultado.txt npx vitest run <este archivo>
//
// Escribe una tabla con la fracción mínima del ancho que debe ocupar el código
// para leerse con cada forma de analizar la imagen (ver readability.ts).

const run = process.env.SCANNER_BENCH ? describe : describe.skip;

const SCENARIOS: Scenario[] = [
  { name: "720x1280 nítido", streamWidth: 720, streamHeight: 1280, blurFraction: 0, noiseSigma: 3 },
  { name: "1080x1920 nítido", streamWidth: 1080, streamHeight: 1920, blurFraction: 0, noiseSigma: 3 },
  { name: "1080x1920 desenfoque suave", streamWidth: 1080, streamHeight: 1920, blurFraction: 0.0006, noiseSigma: 5 },
  { name: "1080x1920 desenfoque medio", streamWidth: 1080, streamHeight: 1920, blurFraction: 0.0012, noiseSigma: 8 },
];

const PIPELINES: { label: string; kinds: PassSpec[] }[] = [
  { label: "anterior: visible a 640", kinds: [LEGACY_PASS] },
  { label: "visible a 960", kinds: [{ region: "visible", maxWidth: 960 }] },
  { label: "franja nativa (1600)", kinds: [{ region: "band", maxWidth: 1600 }] },
  { label: "franja a 1200", kinds: [{ region: "band", maxWidth: 1200 }] },
  { label: "franja a 960", kinds: [{ region: "band", maxWidth: 960 }] },
  { label: "franja a 720", kinds: [{ region: "band", maxWidth: 720 }] },
];

async function table(label: string, decoder: BenchDecoder): Promise<string[]> {
  const rows: string[] = [`## ${label}`];
  for (const scenario of SCENARIOS) {
    for (const pipeline of PIPELINES) {
      const min = await minSpanFraction(scenario, pipeline.kinds, decoder);
      const ms = await msPerEmptyAttempt(scenario, pipeline.kinds, decoder);
      rows.push(
        `${scenario.name.padEnd(28)} | ${pipeline.label.padEnd(24)} | ${
          Number.isNaN(min) ? "   n/a" : (min * 100).toFixed(1).padStart(5) + "%"
        } del ancho | ${ms.toFixed(1).padStart(6)} ms/intento`,
      );
    }
  }
  return rows;
}

run("banco de lectura (opt-in)", () => {
  it("ZXing JS (el de la app)", { timeout: 900_000 }, async () => {
    const rows = await table("ZXing JS (@zxing/library)", zxingJsDecoder(zxing));
    const text = rows.join("\n");
    console.log("\n" + text);
    if (process.env.SCANNER_BENCH_OUT) writeFileSync(process.env.SCANNER_BENCH_OUT, text + "\n");
  });
});
