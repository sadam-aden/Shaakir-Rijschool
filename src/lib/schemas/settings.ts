import { z } from "zod";

/** Rules of the AI planner that the admin may change (the hard rules themselves can never be switched off). */
export const schedulingSettingsSchema = z.object({
  /** exam candidates are planned before everybody else */
  examFirst: z.boolean().default(true),
  defaultDurationMin: z.number().int().min(30).max(240).multipleOf(15).default(60),
  /** longer lessons for students with an exam coming up (if they have the hours) */
  examDurationMin: z.number().int().min(30).max(240).multipleOf(15).default(90),
  /** longest drive between two pick-ups the planner accepts */
  maxTravelMinutes: z.number().int().min(5).max(90).default(25),
});
export type SchedulingSettings = z.infer<typeof schedulingSettingsSchema>;

/** School.settings JSON. Every field has a default so older rows keep working. */
export const schoolSettingsSchema = z.object({
  maxTeachingMinutesPerDay: z.number().int().min(60).max(960).default(480),
  travelBufferMin: z.number().int().min(0).max(60).default(10),
  cancellationWindowHours: z.number().int().min(0).max(240).default(24),
  reminder24h: z.boolean().default(true),
  allowBookingOnUnpaid: z.boolean().default(false),
  vatRate: z.number().int().min(0).max(30).default(21),
  paymentTermDays: z.number().int().min(0).max(120).default(14),
  reminderDaysOverdue: z.array(z.number().int()).default([3, 10]),
  smsSender: z.string().max(11).default("ShaakirRS"),
  lowHoursMinutes: z.number().int().min(0).default(180),
  scheduling: schedulingSettingsSchema.default(() => schedulingSettingsSchema.parse({})),
});
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;

export const parseSettings = (raw: unknown): SchoolSettings => schoolSettingsSchema.parse(raw ?? {});
