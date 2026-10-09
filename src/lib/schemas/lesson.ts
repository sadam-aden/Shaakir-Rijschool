import { z } from "zod";

const iso = z.string().refine((s) => !Number.isNaN(Date.parse(s)), "date");

export const notifySchema = z.object({ sms: z.boolean(), email: z.boolean(), reminder: z.boolean() });
export type NotifyChoice = z.infer<typeof notifySchema>;

export const overrideSchema = z.object({
  availability: z.boolean().optional(),
  hours: z.boolean().optional(),
  payment: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

export const bookLessonSchema = z.object({
  studentId: z.string().min(1),
  type: z.enum(["PRACTICAL", "EXAM"]),
  instructorId: z.string().min(1),
  startsAt: iso,
  durationMin: z.number().int().min(30).max(240).multipleOf(15),
  pickupAddress: z.string().trim().max(200).optional(),
  vehicleId: z.string().optional(),
  /** total number of weekly occurrences including the first (1 = no repeat) */
  occurrences: z.number().int().min(1).max(12).default(1),
  notify: notifySchema,
  override: overrideSchema.optional(),
});
export type BookLessonInput = z.input<typeof bookLessonSchema>;

export const moveLessonSchema = z.object({
  lessonId: z.string().min(1),
  startsAt: iso,
  durationMin: z.number().int().min(30).max(240).multipleOf(15).optional(),
  instructorId: z.string().optional(),
  vehicleId: z.string().optional(),
  pickupAddress: z.string().trim().max(200).optional(),
  notify: z.boolean().default(false),
  override: overrideSchema.optional(),
});
export type MoveLessonInput = z.input<typeof moveLessonSchema>;

export const completeLessonSchema = z.object({
  lessonId: z.string().min(1),
  skills: z.array(z.object({ skillId: z.string(), value: z.number().int().min(0).max(100) })).default([]),
  instructorNotes: z.string().max(2000).optional(),
  studentNotes: z.string().max(2000).optional(),
});
export type CompleteLessonInput = z.input<typeof completeLessonSchema>;

export const cancelLessonSchema = z.object({
  lessonId: z.string().min(1),
  by: z.enum(["STUDENT", "SCHOOL"]),
  reason: z.string().trim().max(300).optional(),
  /** undefined = decide from the cancellation window */
  chargeable: z.boolean().optional(),
  notify: z.boolean().default(true),
});
export type CancelLessonInput = z.input<typeof cancelLessonSchema>;
