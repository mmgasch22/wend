// Validación y normalización de códigos de barras de productos (EAN/UPC).
//
// Un código leído por la cámara puede venir mal (lectura parcial) y uno
// escrito a mano puede tener una errata. El dígito de control del estándar
// GS1 permite descartar la mayoría de esos casos antes de consultar nada.

export type BarcodeParseResult =
  | { ok: true; code: string }
  | { ok: false; reason: "format" | "checksum" };

// EAN-8, UPC-A (12), EAN-13 y GTIN-14.
const VALID_LENGTHS = new Set([8, 12, 13, 14]);

// Dígito de control GS1: de derecha a izquierda (sin contar el propio dígito
// de control) se multiplica por 3, 1, 3, 1... y el total debe completar la
// decena siguiente.
export function hasValidCheckDigit(digits: string): boolean {
  if (!/^\d+$/.test(digits) || digits.length < 2) return false;

  const body = digits.slice(0, -1);
  const check = Number(digits[digits.length - 1]);

  let sum = 0;
  for (let i = 0; i < body.length; i++) {
    const digit = Number(body[body.length - 1 - i]);
    sum += digit * (i % 2 === 0 ? 3 : 1);
  }

  return (10 - (sum % 10)) % 10 === check;
}

// Deja un único formato para un mismo producto: los UPC-A (12 dígitos) son
// un EAN-13 con un 0 delante, y OpenFoodFacts los guarda así. Así un mismo
// producto no puede quedar guardado con dos códigos distintos.
function toCanonicalLength(digits: string): string {
  if (digits.length === 12) return `0${digits}`;
  if (digits.length === 14 && digits.startsWith("0")) return digits.slice(1);
  return digits;
}

export function parseBarcode(raw: string): BarcodeParseResult {
  const digits = raw.replace(/[\s-]/g, "");

  if (!/^\d+$/.test(digits) || !VALID_LENGTHS.has(digits.length)) {
    return { ok: false, reason: "format" };
  }
  if (!hasValidCheckDigit(digits)) {
    return { ok: false, reason: "checksum" };
  }

  return { ok: true, code: toCanonicalLength(digits) };
}
