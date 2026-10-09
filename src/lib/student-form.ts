import type { StudentInput } from "@/lib/schemas/student";

type StudentLike = {
  firstName: string; lastName: string; phone: string | null; email: string | null; birthDate: Date | null; address: string | null;
  postcode: string | null; area: string | null; gearbox: "MANUAL" | "AUTOMATIC"; track: "PRACTICAL" | "THEORY_ONLY" | "BOTH";
  status: "WAITING_LIST" | "ACTIVE" | "PAUSED" | "PASSED" | "ARCHIVED"; primaryInstructorId: string | null; locale: "nl" | "en";
  smsConsent: boolean; emailConsent: boolean; cbrCandidateNumber: string | null; guardianName: string | null;
  guardianPhone: string | null; guardianEmail: string | null; notes: string | null;
};

/** Turns a Student row into the values of the edit form. */
export function studentToFormValues(s: StudentLike): StudentInput {
  return {
    firstName: s.firstName, lastName: s.lastName, phone: s.phone ?? "", email: s.email ?? "",
    birthDate: s.birthDate ? s.birthDate.toISOString().slice(0, 10) : "", address: s.address ?? "", postcode: s.postcode ?? "",
    area: s.area ?? "", gearbox: s.gearbox, track: s.track, status: s.status, primaryInstructorId: s.primaryInstructorId ?? "",
    locale: s.locale, smsConsent: s.smsConsent, emailConsent: s.emailConsent, cbrCandidateNumber: s.cbrCandidateNumber ?? "",
    guardianName: s.guardianName ?? "", guardianPhone: s.guardianPhone ?? "", guardianEmail: s.guardianEmail ?? "", notes: s.notes ?? "",
  };
}
