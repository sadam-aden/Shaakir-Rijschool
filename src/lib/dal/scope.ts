/**
 * Pure scoping rules shared by every DAL query. Kept free of I/O so they can be unit tested.
 * Admin: everything in their school. Instructor: only rows tied to their own instructorId.
 */
export type ScopeUser = { role: "ADMIN" | "INSTRUCTOR"; schoolId: string; instructorId: string | null };

/** Instructors without an Instructor record get an impossible filter, never "everything". */
const NOBODY = "__none__";

export function lessonScope(u: ScopeUser) {
  if (u.role === "ADMIN") return { schoolId: u.schoolId };
  return { schoolId: u.schoolId, instructorId: u.instructorId ?? NOBODY };
}

/** Students an instructor may see: assigned to them, or with at least one lesson together. */
export function studentScope(u: ScopeUser) {
  if (u.role === "ADMIN") return { schoolId: u.schoolId };
  const id = u.instructorId ?? NOBODY;
  return {
    schoolId: u.schoolId,
    OR: [{ primaryInstructorId: id }, { lessons: { some: { instructorId: id } } }],
  };
}

export function canSeeMoney(u: ScopeUser) {
  return u.role === "ADMIN";
}
