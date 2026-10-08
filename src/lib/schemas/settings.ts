import { z } from "zod";

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
});
export type SchoolSettings = z.infer<typeof schoolSettingsSchema>;

export const parseSettings = (raw: unknown): SchoolSettings => schoolSettingsSchema.parse(raw ?? {});
