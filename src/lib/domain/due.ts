/** Due-date urgency for APK / service / insurance: amber within 30 days, red when overdue. */
export type DueState = { kind: "none" } | { kind: "ok" | "soon"; days: number } | { kind: "overdue"; days: number } | { kind: "today" };

export function dueState(due: Date | null, now: Date, soonDays = 30): DueState {
  if (!due) return { kind: "none" };
  const startOfDay = (d: Date) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  const days = Math.round((startOfDay(due) - startOfDay(now)) / 86_400_000);
  if (days < 0) return { kind: "overdue", days: -days };
  if (days === 0) return { kind: "today" };
  return { kind: days <= soonDays ? "soon" : "ok", days };
}
