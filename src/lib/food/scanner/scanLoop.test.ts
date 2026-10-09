import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createScanLoop } from "./scanLoop";

describe("createScanLoop", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("entrega el primer código aceptable y se detiene", async () => {
    const onCode = vi.fn();
    const detect = vi.fn().mockResolvedValue("3017620422003");
    const loop = createScanLoop({ detect, onCode, intervalMs: 100 });

    loop.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onCode).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledWith("3017620422003");
    // Tras entregar el código no se sigue leyendo.
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it("el mismo código visto muchas veces solo se entrega una vez", async () => {
    const onCode = vi.fn();
    const loop = createScanLoop({
      detect: () => "3017620422003",
      onCode,
      intervalMs: 10,
    });

    loop.start();
    loop.start(); // un segundo start no crea un segundo bucle
    await vi.advanceTimersByTimeAsync(2000);

    expect(onCode).toHaveBeenCalledTimes(1);
  });

  it("sigue intentando mientras no lea nada", async () => {
    const onCode = vi.fn();
    const detect = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce("96385074");
    const loop = createScanLoop({ detect, onCode, intervalMs: 100 });

    loop.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(detect).toHaveBeenCalledTimes(3);
    expect(onCode).toHaveBeenCalledWith("96385074");
  });

  it("ignora lecturas no aceptables y espera una buena", async () => {
    const onCode = vi.fn();
    const detect = vi
      .fn()
      .mockResolvedValueOnce("1234567890123") // lectura mala
      .mockResolvedValueOnce("3017620422003");
    const loop = createScanLoop({
      detect,
      onCode,
      isAcceptable: (raw) => raw === "3017620422003",
      intervalMs: 100,
    });

    loop.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onCode).toHaveBeenCalledTimes(1);
    expect(onCode).toHaveBeenCalledWith("3017620422003");
  });

  it("un error del detector no detiene el bucle", async () => {
    const onCode = vi.fn();
    const detect = vi
      .fn()
      .mockRejectedValueOnce(new Error("frame no listo"))
      .mockResolvedValueOnce("96385074");
    const loop = createScanLoop({ detect, onCode, intervalMs: 100 });

    loop.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(onCode).toHaveBeenCalledWith("96385074");
  });

  it("después de stop() no se entrega nada, ni lo que ya estaba leyéndose", async () => {
    const onCode = vi.fn();
    let finishRead: (value: string) => void = () => {};
    const detect = vi.fn(
      () =>
        new Promise<string>((resolve) => {
          finishRead = resolve;
        }),
    );
    const loop = createScanLoop({ detect, onCode, intervalMs: 100 });

    loop.start();
    await vi.advanceTimersByTimeAsync(10); // la lectura ya está en curso
    loop.stop();
    finishRead("3017620422003"); // llega tarde
    await vi.advanceTimersByTimeAsync(1000);

    expect(onCode).not.toHaveBeenCalled();
    expect(detect).toHaveBeenCalledTimes(1);
  });

  it("stop() antes de empezar a leer cancela el siguiente intento", async () => {
    const detect = vi.fn().mockResolvedValue(null);
    const loop = createScanLoop({ detect, onCode: vi.fn(), intervalMs: 100 });

    loop.start();
    loop.stop();
    await vi.advanceTimersByTimeAsync(1000);

    expect(detect).not.toHaveBeenCalled();
  });

  it("no hay dos lecturas a la vez aunque una tarde más que el intervalo", async () => {
    let active = 0;
    let maxActive = 0;
    const detect = vi.fn(async () => {
      active++;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 500));
      active--;
      return null;
    });
    const loop = createScanLoop({ detect, onCode: vi.fn(), intervalMs: 50 });

    loop.start();
    await vi.advanceTimersByTimeAsync(3000);
    loop.stop();

    expect(maxActive).toBe(1);
    expect(detect.mock.calls.length).toBeGreaterThan(1);
  });

  it("informa del número de intento para poder alternar la forma de leer", async () => {
    const seen: number[] = [];
    const loop = createScanLoop({
      detect: (attempt) => {
        seen.push(attempt);
        return attempt === 3 ? "96385074" : null;
      },
      onCode: vi.fn(),
      intervalMs: 50,
    });

    loop.start();
    await vi.advanceTimersByTimeAsync(1000);

    expect(seen).toEqual([0, 1, 2, 3]);
  });
});
