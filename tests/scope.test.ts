import { describe, expect, it } from "vitest";
import { canSeeMoney, lessonScope, studentScope } from "@/lib/dal/scope";

const admin = { role: "ADMIN" as const, schoolId: "s1", instructorId: "i1" };
const julia = { role: "INSTRUCTOR" as const, schoolId: "s1", instructorId: "i2" };
const orphan = { role: "INSTRUCTOR" as const, schoolId: "s1", instructorId: null };

describe("DAL scoping", () => {
  it("admin lesson queries are limited to the school only", () => {
    expect(lessonScope(admin)).toEqual({ schoolId: "s1" });
  });
  it("instructor lesson queries are always filtered by instructorId", () => {
    expect(lessonScope(julia)).toEqual({ schoolId: "s1", instructorId: "i2" });
  });
  it("instructor without an Instructor record matches nothing", () => {
    expect(lessonScope(orphan)).toEqual({ schoolId: "s1", instructorId: "__none__" });
  });
  it("instructor students = assigned or shared lessons", () => {
    expect(studentScope(julia)).toEqual({
      schoolId: "s1",
      OR: [{ primaryInstructorId: "i2" }, { lessons: { some: { instructorId: "i2" } } }],
    });
  });
  it("only admins see money", () => {
    expect(canSeeMoney(admin)).toBe(true);
    expect(canSeeMoney(julia)).toBe(false);
  });
});
