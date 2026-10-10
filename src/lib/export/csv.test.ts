import { describe, expect, it } from "vitest";
import { csvCell, toCsv } from "./csv";

describe("csvCell", () => {
  it("deja los valores simples tal cual y vacía null/undefined", () => {
    expect(csvCell("pan")).toBe("pan");
    expect(csvCell(12.5)).toBe("12.5");
    expect(csvCell(null)).toBe("");
    expect(csvCell(undefined)).toBe("");
  });

  it("entrecomilla comas, comillas y saltos de línea", () => {
    expect(csvCell("a,b")).toBe('"a,b"');
    expect(csvCell('di "hola"')).toBe('"di ""hola"""');
    expect(csvCell("uno\ndos")).toBe('"uno\ndos"');
  });

  it("neutraliza textos que Excel interpretaría como fórmula", () => {
    expect(csvCell("=HYPERLINK(\"http://x\")")).toBe(`"'=HYPERLINK(""http://x"")"`);
    expect(csvCell("+34 600")).toBe("'+34 600");
    expect(csvCell("-1")).toBe("'-1");
    expect(csvCell("@cmd")).toBe("'@cmd");
  });

  it("no altera los números negativos", () => {
    expect(csvCell(-3.5)).toBe("-3.5");
  });
});

describe("toCsv", () => {
  it("escribe cabecera, filas, BOM y CRLF", () => {
    const out = toCsv(["fecha", "nombre"], [
      { fecha: "2026-10-10", nombre: "Pollo, a la plancha" },
      { fecha: "2026-10-11", nombre: null },
    ]);
    expect(out).toBe(
      '﻿fecha,nombre\r\n2026-10-10,"Pollo, a la plancha"\r\n2026-10-11,\r\n',
    );
  });
});
