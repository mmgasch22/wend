import { describe, expect, it } from "vitest";
import {
  initialZoom,
  parseScannerProfile,
  readCameraCapabilities,
  scannerVideoConstraints,
  scanHint,
  zoomPresets,
} from "./camera";

describe("scannerVideoConstraints", () => {
  it("pide la cámara trasera y 1080p como valores ideales, nunca obligatorios", () => {
    const { video } = scannerVideoConstraints("estandar");
    expect(video).toMatchObject({
      facingMode: { ideal: "environment" },
      width: { ideal: 1920 },
      height: { ideal: 1080 },
    });
    // Ningún `exact` ni `min`: un móvil sin 1080p entrega lo que tenga.
    expect(JSON.stringify(video)).not.toMatch(/exact|"min"/);
  });

  it("el perfil anterior conserva los 1280x720 de antes, para poder comparar", () => {
    const { video } = scannerVideoConstraints("anterior");
    expect(video).toMatchObject({ width: { ideal: 1280 }, height: { ideal: 720 } });
  });

  it("no pide audio", () => {
    expect(scannerVideoConstraints("estandar").audio).toBe(false);
  });
});

describe("parseScannerProfile", () => {
  it("solo 'anterior' activa la versión antigua", () => {
    expect(parseScannerProfile("anterior")).toBe("anterior");
    expect(parseScannerProfile(null)).toBe("estandar");
    expect(parseScannerProfile(undefined)).toBe("estandar");
    expect(parseScannerProfile("otra")).toBe("estandar");
  });
});

describe("readCameraCapabilities", () => {
  it("lee zoom, enfoque continuo y linterna cuando existen", () => {
    const caps = readCameraCapabilities({
      getCapabilities: () => ({
        zoom: { min: 1, max: 8, step: 0.1 },
        focusMode: ["manual", "continuous"],
        torch: true,
      }),
    });
    expect(caps).toEqual({
      zoom: { min: 1, max: 8, step: 0.1 },
      focusContinuous: true,
      torch: true,
    });
  });

  it("un navegador que no expone capacidades (Safari, Firefox) no da error", () => {
    expect(readCameraCapabilities({})).toEqual({
      zoom: null,
      focusContinuous: false,
      torch: false,
    });
    expect(
      readCameraCapabilities({
        getCapabilities: () => {
          throw new Error("no soportado");
        },
      }),
    ).toEqual({ zoom: null, focusContinuous: false, torch: false });
  });

  it("un rango de zoom sin recorrido no cuenta como zoom", () => {
    const caps = readCameraCapabilities({
      getCapabilities: () => ({ zoom: { min: 1, max: 1, step: 0.1 } }),
    });
    expect(caps.zoom).toBeNull();
  });

  it("enfoque que no es continuo no se marca", () => {
    const caps = readCameraCapabilities({
      getCapabilities: () => ({ focusMode: ["manual", "single-shot"] }),
    });
    expect(caps.focusContinuous).toBe(false);
  });
});

describe("zoomPresets", () => {
  it("ofrece solo los niveles que el móvil admite", () => {
    expect(zoomPresets({ min: 1, max: 8, step: 0.1 })).toEqual([1, 2, 3, 5]);
    expect(zoomPresets({ min: 1, max: 3, step: 0.1 })).toEqual([1, 2, 3]);
    expect(zoomPresets({ min: 1, max: 2, step: 0.1 })).toEqual([1, 2]);
  });

  it("no ofrece zoom si no existe o si el rango no sirve de nada", () => {
    expect(zoomPresets(null)).toEqual([]);
    expect(zoomPresets({ min: 1, max: 1.3, step: 0.1 })).toEqual([]);
  });

  it("respeta un mínimo mayor que 1", () => {
    expect(zoomPresets({ min: 2, max: 8, step: 0.1 })).toEqual([2, 3, 5]);
  });
});

describe("initialZoom", () => {
  const range = { min: 1, max: 8, step: 0.1 };

  it("por defecto empieza en 2x si el móvil lo admite", () => {
    expect(initialZoom(range, null)).toBe(2);
  });

  it("recuerda el último zoom elegido si sigue siendo válido", () => {
    expect(initialZoom(range, 3)).toBe(3);
    expect(initialZoom(range, 1)).toBe(1);
  });

  it("ignora un zoom guardado que este móvil no admite", () => {
    expect(initialZoom({ min: 1, max: 3, step: 0.1 }, 5)).toBe(2);
  });

  it("sin zoom disponible no aplica ninguno", () => {
    expect(initialZoom(null, 2)).toBeNull();
    expect(initialZoom({ min: 1, max: 1.2, step: 0.1 }, null)).toBeNull();
  });

  it("si el mínimo ya supera 2x usa el nivel más cercano disponible", () => {
    expect(initialZoom({ min: 3, max: 8, step: 0.1 }, null)).toBe(5);
  });
});

describe("scanHint", () => {
  it("no molesta durante los primeros segundos", () => {
    expect(scanHint(0, true)).toBeNull();
    expect(scanHint(3999, false)).toBeNull();
  });

  it("después aconseja distancia y enfoque", () => {
    expect(scanHint(5000, true)).toMatch(/acercarte o alejarte/);
  });

  it("si lleva mucho tiempo, aconseja luz, ángulo y escribir el código", () => {
    expect(scanHint(12000, false)).toMatch(/luz/);
    expect(scanHint(12000, false)).toMatch(/escribe el código/);
    expect(scanHint(12000, false)).not.toMatch(/zoom/);
  });

  it("menciona el zoom solo si el móvil lo tiene", () => {
    expect(scanHint(12000, true)).toMatch(/zoom/);
  });
});
