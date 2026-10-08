/**
 * Derived student status and exam readiness. Defined once; reused by every page.
 * Priority: Exam requested > CBR exam {day} > Theory exam {date} > Low hours > Unscheduled > Theory only > Active.
 */
import { LOW_HOURS_MINUTES } from "./ledger";

export type DerivedStatus =
  | { kind: "examRequested" }
  | { kind: "cbrExam"; at: Date }
  | { kind: "theoryExam"; at: Date }
  | { kind: "lowHours" }
  | { kind: "unscheduled" }
  | { kind: "theoryOnly" }
  | { kind: "active" }
  | { kind: "waitingList" }
  | { kind: "paused" }
  | { kind: "passed" }
  | { kind: "archived" };

export type StatusInput = {
  status: "WAITING_LIST" | "ACTIVE" | "PAUSED" | "PASSED" | "ARCHIVED";
  track: "PRACTICAL" | "THEORY_ONLY" | "BOTH";
  /** hours still owned (remaining − reserved = available is used for the low-hours rule) */
  minutesAvailable: number;
  hasUpcomingLesson: boolean;
  exams: { kind: "THEORY" | "PRACTICAL" | "TUSSENTIJDSE_TOETS"; status: string; scheduledAt: Date | null }[];
  now: Date;
  lowHoursMinutes?: number;
};

export function deriveStatus(i: StatusInput): DerivedStatus {
  if (i.status === "WAITING_LIST") return { kind: "waitingList" };
  if (i.status === "PAUSED") return { kind: "paused" };
  if (i.status === "PASSED") return { kind: "passed" };
  if (i.status === "ARCHIVED") return { kind: "archived" };

  if (i.exams.some((x) => x.kind === "PRACTICAL" && x.status === "REQUESTED")) return { kind: "examRequested" };
  const upcoming = (kind: string) =>
    i.exams
      .filter((x) => x.kind === kind && x.status === "SCHEDULED" && x.scheduledAt && x.scheduledAt >= i.now)
      .sort((a, b) => +a.scheduledAt! - +b.scheduledAt!)[0];
  const cbr = upcoming("PRACTICAL");
  if (cbr) return { kind: "cbrExam", at: cbr.scheduledAt! };
  const theory = upcoming("THEORY");
  if (theory) return { kind: "theoryExam", at: theory.scheduledAt! };

  if (i.track !== "THEORY_ONLY" && i.minutesAvailable < (i.lowHoursMinutes ?? LOW_HOURS_MINUTES)) return { kind: "lowHours" };
  if (i.track !== "THEORY_ONLY" && !i.hasUpcomingLesson) return { kind: "unscheduled" };
  if (i.track === "THEORY_ONLY") return { kind: "theoryOnly" };
  return { kind: "active" };
}

export const READY_THRESHOLD = 80;

/**
 * Exam readiness: all core skills >= 80 % → READY; otherwise estimate lessons left from the
 * average progress per completed lesson (null when it cannot be estimated yet).
 */
export function estimateReadiness(skillValues: number[], lessonsCompleted: number) {
  if (skillValues.length === 0) return { readiness: "NEEDS_LESSONS" as const, lessonsLeft: null };
  if (skillValues.every((v) => v >= READY_THRESHOLD)) return { readiness: "READY" as const, lessonsLeft: 0 };
  const mean = skillValues.reduce((a, b) => a + b, 0) / skillValues.length;
  const perLesson = lessonsCompleted > 0 ? mean / lessonsCompleted : 0;
  const lessonsLeft = perLesson > 0 ? Math.ceil((READY_THRESHOLD - mean) / perLesson) : null;
  return { readiness: "NEEDS_LESSONS" as const, lessonsLeft };
}
