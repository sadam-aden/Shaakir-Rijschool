/**
 * Dutch phone numbers. Students must live in the Netherlands, so only Dutch numbers are accepted.
 * Accepted input: 06 12345678, 0612345678, 06-12345678, +31 6 12345678, +31 (0)6 12345678, 0031 6 12345678, 010 1234567 …
 * Stored as E.164 ("+31612345678"), which is what SMS providers need.
 */
export function normalizeDutchPhone(input: string): string | null {
  let s = input.trim().replace(/\(0\)/g, "").replace(/[\s().-]/g, "");
  if (s.startsWith("+31")) s = s.slice(3);
  else if (s.startsWith("0031")) s = s.slice(4);
  else if (s.startsWith("0") && !s.startsWith("00")) s = s.slice(1);
  else return null; // another country code, or not a number at all
  // national significant number: 9 digits; first digit 1–5 (landline), 6 (mobile) or 7 (landline); 8 and 9 are service numbers
  if (!/^[1-7]\d{8}$/.test(s)) return null;
  return `+31${s}`;
}

export const isDutchMobile = (e164: string) => /^\+316\d{8}$/.test(e164);

/** "+31612345678" → "06 12345678" (mobile) or "010 1234567" style for landlines; unknown shapes are returned unchanged. */
export function formatDutchPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+31(\d{9})$/.exec(e164);
  if (!m) return e164;
  const n = m[1];
  if (n.startsWith("6")) return `0${n.slice(0, 1)} ${n.slice(1)}`;
  // area codes: 010, 020, 071 … (0 + 2 digits); the older Zeeland codes 0111–0118 have 0 + 3 digits
  const len = n.startsWith("11") ? 3 : 2;
  return `0${n.slice(0, len)} ${n.slice(len)}`;
}

/** Digits a user might type when searching a student by phone, in national and international spelling. */
export function phoneSearchVariants(query: string): string[] {
  const digits = query.replace(/\D/g, "");
  if (digits.length < 3) return [];
  const out = new Set([digits]);
  if (digits.startsWith("0") && !digits.startsWith("00")) out.add(`31${digits.slice(1)}`);
  if (digits.startsWith("0031")) out.add(digits.slice(2));
  return [...out];
}
