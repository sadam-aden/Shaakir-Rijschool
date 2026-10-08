/**
 * Age rule for students. Dates are 'YYYY-MM-DD' calendar dates (no timezone math involved).
 * A person born on 29 February turns a year older on 1 March in non-leap years.
 */
export const MIN_STUDENT_AGE = 18;

const parts = (key: string) => {
  const [y, m, d] = key.split("-").map(Number);
  return { y, m, d };
};

export function isValidDateKey(key: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(key)) return false;
  const { y, m, d } = parts(key);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

/** Completed years on the given day. */
export function ageOn(birthKey: string, onKey: string) {
  const b = parts(birthKey);
  const o = parts(onKey);
  const hadBirthday = o.m > b.m || (o.m === b.m && o.d >= b.d);
  return o.y - b.y - (hadBirthday ? 0 : 1);
}

export function isAtLeastAge(birthKey: string, onKey: string, minAge = MIN_STUDENT_AGE) {
  return ageOn(birthKey, onKey) >= minAge;
}

/** Latest birth date that is still old enough on the given day (used as the date picker's max). */
export function latestBirthDate(onKey: string, minAge = MIN_STUDENT_AGE) {
  const o = parts(onKey);
  const y = o.y - minAge;
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  const d = o.m === 2 && o.d === 29 && !leap ? 28 : o.d;
  return `${String(y).padStart(4, "0")}-${String(o.m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
