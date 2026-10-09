import { describe, expect, it } from "vitest";
import { hasValidCheckDigit, parseBarcode } from "./barcode";

describe("hasValidCheckDigit", () => {
  it("acepta códigos reales con dígito de control correcto", () => {
    expect(hasValidCheckDigit("3017620422003")).toBe(true); // EAN-13 (Nutella)
    expect(hasValidCheckDigit("5449000000996")).toBe(true); // EAN-13 (Coca-Cola)
    expect(hasValidCheckDigit("96385074")).toBe(true); // EAN-8
    expect(hasValidCheckDigit("049000028911")).toBe(true); // UPC-A
  });

  it("rechaza un dígito de control incorrecto", () => {
    expect(hasValidCheckDigit("3017620422004")).toBe(false);
    expect(hasValidCheckDigit("96385075")).toBe(false);
  });

  it("rechaza lo que no son solo dígitos", () => {
    expect(hasValidCheckDigit("30176204220A3")).toBe(false);
    expect(hasValidCheckDigit("")).toBe(false);
    expect(hasValidCheckDigit("7")).toBe(false);
  });
});

describe("parseBarcode", () => {
  it("devuelve el código tal cual si ya es un EAN-13 válido", () => {
    expect(parseBarcode("3017620422003")).toEqual({ ok: true, code: "3017620422003" });
  });

  it("ignora espacios y guiones al escribir a mano", () => {
    expect(parseBarcode(" 3017 6204-22003 ")).toEqual({ ok: true, code: "3017620422003" });
  });

  it("convierte un UPC-A de 12 dígitos al EAN-13 equivalente", () => {
    expect(parseBarcode("049000028911")).toEqual({ ok: true, code: "0049000028911" });
  });

  it("deja el EAN-8 como está", () => {
    expect(parseBarcode("96385074")).toEqual({ ok: true, code: "96385074" });
  });

  it("quita el 0 inicial de un GTIN-14 equivalente a EAN-13", () => {
    expect(parseBarcode("03017620422003")).toEqual({ ok: true, code: "3017620422003" });
  });

  it("rechaza longitudes que no existen", () => {
    expect(parseBarcode("12345")).toEqual({ ok: false, reason: "format" });
    expect(parseBarcode("301762042200")).toEqual({ ok: false, reason: "checksum" }); // 12 dígitos pero sin control válido
    expect(parseBarcode("30176204220033")).toEqual({ ok: false, reason: "checksum" }); // 14 dígitos pero sin control válido
  });

  it("rechaza texto y cadenas vacías", () => {
    expect(parseBarcode("")).toEqual({ ok: false, reason: "format" });
    expect(parseBarcode("abcdefghijklm")).toEqual({ ok: false, reason: "format" });
  });

  it("detecta una errata aunque la longitud sea correcta", () => {
    expect(parseBarcode("3017620422005")).toEqual({ ok: false, reason: "checksum" });
  });
});
