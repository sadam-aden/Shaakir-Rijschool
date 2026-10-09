/**
 * CSV for Dutch Excel: semicolon separated, UTF-8 BOM, CRLF line ends, decimal comma.
 * Cells that contain a semicolon, quote or line break are quoted; cells that start with = + - @ are neutralised
 * so a student name can never turn into a spreadsheet formula.
 */
export const BOM = "﻿";

export function csvCell(v: string | number | null | undefined): string {
  let s = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : v;
  if (/^[=+\-@\t\r]/.test(s) && typeof v === "string") s = `'${s}`;
  return /[;"\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
  return BOM + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
}

/** 189000 → "1890,00" (no thousands separator, so Excel reads it as a number). */
export const euros = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");
