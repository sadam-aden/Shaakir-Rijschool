import { z } from "zod";
import { isAtLeastAge, isValidDateKey } from "@/lib/domain/age";
import { localDateKey } from "@/lib/domain/time";

const optionalText = z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || undefined);

/** Shared by the client form (react-hook-form) and the server action. */
export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(80),
  lastName: z.string().trim().min(1, "required").max(80),
  phone: optionalText,
  email: z.string().trim().email("email").optional().or(z.literal("")).transform((v) => v || undefined),
  // required: students must be at least MIN_STUDENT_AGE (error codes are keys under students.form.*)
  birthDate: z.string().superRefine((v, ctx) => {
    const issue = (message: string) => ctx.addIssue({ code: "custom", message });
    if (!v) return issue("birthRequired");
    if (!isValidDateKey(v)) return issue("birthInvalid");
    const today = localDateKey(new Date());
    if (v > today) return issue("birthFuture");
    if (!isAtLeastAge(v, today)) return issue("tooYoung");
  }),
  address: optionalText,
  postcode: optionalText,
  // exact position, set when an address suggestion is picked (otherwise derived from the chosen place)
  lat: z.number().min(50).max(54).optional(),
  lng: z.number().min(3).max(8).optional(),
  province: optionalText,
  city: optionalText,
  area: optionalText,
  gearbox: z.enum(["MANUAL", "AUTOMATIC"]),
  track: z.enum(["PRACTICAL", "THEORY_ONLY", "BOTH"]),
  status: z.enum(["WAITING_LIST", "ACTIVE", "PAUSED", "PASSED", "ARCHIVED"]),
  primaryInstructorId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  locale: z.enum(["nl", "en"]),
  smsConsent: z.boolean(),
  emailConsent: z.boolean(),
  cbrCandidateNumber: optionalText,
  guardianName: optionalText,
  guardianPhone: optionalText,
  guardianEmail: z.string().trim().email("email").optional().or(z.literal("")).transform((v) => v || undefined),
  notes: z.string().max(4000).optional().or(z.literal("")).transform((v) => v || undefined),
});
export type StudentInput = z.input<typeof studentSchema>;
export type StudentData = z.output<typeof studentSchema>;
