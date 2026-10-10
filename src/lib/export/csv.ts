// CSV mínimo para la exportación de datos del usuario.
//
// Dos cuidados: (1) escapar comillas, comas y saltos de línea (RFC 4180);
// (2) neutralizar la "inyección de fórmulas": un texto que empiece por = + - @
// (o tabulador / retorno) se interpreta como fórmula al abrir el CSV en Excel o
// Sheets. Un alimento creado a mano se llama como quiera su autor, así que se
// antepone una comilla simple a los TEXTOS peligrosos. Los números no se tocan
// (un -3,5 numérico es legítimo).

export type CsvCell = string | number | null | undefined;

const FORMULA_START = /^[=+\-@\t\r]/;

export function csvCell(value: CsvCell): string {
  if (value === null || value === undefined) return "";
  let text = typeof value === "number" ? String(value) : value;
  if (typeof value === "string" && FORMULA_START.test(text)) {
    text = `'${text}`;
  }
  if (/[",\n\r]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(
  columns: readonly string[],
  rows: readonly Record<string, CsvCell>[],
): string {
  const lines = [columns.map(csvCell).join(",")];
  for (const row of rows) {
    lines.push(columns.map((c) => csvCell(row[c])).join(","));
  }
  // BOM para que Excel detecte UTF-8 (acentos); salto CRLF según el RFC.
  return "﻿" + lines.join("\r\n") + "\r\n";
}
