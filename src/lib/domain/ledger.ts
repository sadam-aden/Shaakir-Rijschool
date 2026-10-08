/**
 * Hours ledger rules (pure). The ledger is append-only and the source of truth;
 * Student.minutesRemaining / minutesReserved are caches recomputed with `summarize`.
 *
 *   remaining = PURCHASE + CONSUME + ADJUST + REFUND   (hours still owned, incl. reserved)
 *   reserved  = −(RESERVE + RELEASE)                    (held by planned lessons)
 *   available = remaining − reserved                    (hours that can still be booked)
 */
export type LedgerType = "PURCHASE" | "RESERVE" | "RELEASE" | "CONSUME" | "ADJUST" | "REFUND";
export type LedgerLine = { type: LedgerType; minutes: number };

export function summarize(entries: LedgerLine[]) {
  let remaining = 0;
  let reserved = 0;
  for (const e of entries) {
    if (e.type === "RESERVE" || e.type === "RELEASE") reserved -= e.minutes;
    else remaining += e.minutes;
  }
  return { remaining, reserved, available: remaining - reserved };
}

/** Booking holds the hours. */
export const reserveLines = (minutes: number): LedgerLine[] => [{ type: "RESERVE", minutes: -minutes }];

/** Completed lesson, or a chargeable no-show / late cancellation: hours are used up. */
export const consumeLines = (minutes: number): LedgerLine[] => [
  { type: "RELEASE", minutes },
  { type: "CONSUME", minutes: -minutes },
];

/** Free cancellation: the reserved hours return to the student. */
export const releaseLines = (minutes: number): LedgerLine[] => [{ type: "RELEASE", minutes }];

/** Lesson length changed while planned: hold the difference. */
export function resizeLines(oldMinutes: number, newMinutes: number): LedgerLine[] {
  const diff = newMinutes - oldMinutes;
  if (diff === 0) return [];
  return diff > 0 ? reserveLines(diff) : releaseLines(-diff);
}

/** Cancellation inside the window (default 24 h before the start) is chargeable. */
export function isChargeableCancellation(startsAt: Date, cancelledAt: Date, windowHours: number): boolean {
  return startsAt.getTime() - cancelledAt.getTime() < windowHours * 3_600_000;
}

export type BookCheck = { ok: true } | { ok: false; shortBy: number };

export function canBook(availableMinutes: number, durationMin: number): BookCheck {
  return availableMinutes >= durationMin ? { ok: true } : { ok: false, shortBy: durationMin - availableMinutes };
}

export const LOW_HOURS_MINUTES = 180;
