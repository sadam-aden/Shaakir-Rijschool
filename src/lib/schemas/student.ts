import { z } from "zod";

const optionalText = z.string().trim().max(200).optional().or(z.literal("")).transform((v) => v || undefined);

/** Shared by the client form (react-hook-form) and the server action. */
export const studentSchema = z.object({
  firstName: z.string().trim().min(1, "required").max(80),
  lastName: z.string().trim().min(1, "required").max(80),
  phone: optionalText,
  email: z.string().trim().email("email").optional().or(z.literal("")).transform((v) => v || undefined),
  birthDate: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
  address: optionalText,
  postcode: optionalText,
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
