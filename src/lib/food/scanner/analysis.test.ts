import { describe, expect, it } from "vitest";
import {
  GUIDE_INSET_Y,
  guideBand,
  LEGACY_SCHEDULE,
  passForAttempt,
  planPass,
  SCAN_SCHEDULE,
} from "./analysis";

describe("guideBand", () => {
  it("móvil en vertical: todo el ancho y solo la franja central del recuadro", () => {
    const band = guideBand(1080, 1920);
    expect(band.sx).toBe(0);
    expect(band.sw).toBe(1080);
    // Vídeo visible: 1080 x 810, centrado en vertical.
    expect(band.sh).toBeCloseTo(810 * (1 - 2 * GUIDE_INSET_Y), 6);
    expect(band.sy).toBeCloseTo((1920 - 810) / 2 + 810 * GUIDE_INSET_Y, 6);
  });

  it("la franja siempre cabe dentro del fotograma", () => {
    for (const [w, h] of [
      [1920, 1080],
      [1280, 720],
      [1080, 1920],
      [720, 1280],
      [640, 480],
    ] as const) {
      const band = guideBand(w, h);
      expect(band.sx).toBeGreaterThanOrEqual(0);
      expect(band.sy).toBeGreaterThanOrEqual(0);
      expect(band.sx + band.sw).toBeLessThanOrEqual(w + 1e-6);
      expect(band.sy + band.sh).toBeLessThanOrEqual(h + 1e-6);
    }
  });
});

describe("planPass", () => {
  it("nunca amplía: un flujo pequeño se analiza a su tamaño", () => {
    const plan = planPass({ region: "band", maxWidth: 1200 }, 720, 1280);
    expect(plan.width).toBe(720);
  });

  it("reduce a un ancho máximo manteniendo la proporción", () => {
    const plan = planPass({ region: "band", maxWidth: 960 }, 1080, 1920);
    expect(plan.width).toBe(960);
    expect(plan.height / plan.width).toBeCloseTo(plan.region.sh / plan.region.sw, 2);
  });

  it("un flujo enorme (4K) no obliga a analizar miles de columnas", () => {
    const plan = planPass(SCAN_SCHEDULE[0], 2160, 3840);
    expect(plan.width).toBeLessThanOrEqual(1200);
  });
});

describe("passForAttempt", () => {
  it("rota por las pasadas del calendario", () => {
    expect(passForAttempt(SCAN_SCHEDULE, 0)).toBe(SCAN_SCHEDULE[0]);
    expect(passForAttempt(SCAN_SCHEDULE, 1)).toBe(SCAN_SCHEDULE[1]);
    expect(passForAttempt(SCAN_SCHEDULE, 2)).toBe(SCAN_SCHEDULE[2]);
    expect(passForAttempt(SCAN_SCHEDULE, 3)).toBe(SCAN_SCHEDULE[0]);
  });

  it("el calendario anterior tiene una sola pasada (la de antes)", () => {
    expect(LEGACY_SCHEDULE).toHaveLength(1);
    expect(passForAttempt(LEGACY_SCHEDULE, 7)).toEqual({ region: "visible", maxWidth: 640 });
  });

  it("el calendario nuevo mira primero la franja central, a más resolución", () => {
    expect(SCAN_SCHEDULE[0].region).toBe("band");
    expect(SCAN_SCHEDULE[0].maxWidth).toBeGreaterThan(640);
  });
});
