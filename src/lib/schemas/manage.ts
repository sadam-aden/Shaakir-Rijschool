import { z } from "zod";
import { schoolSettingsSchema } from "./settings";

const text = (max = 200) => z.string().trim().max(max).optional().or(z.literal("")).transform((v) => v || undefined);
const dateText = z.string().optional().or(z.literal("")).transform((v) => v || undefined);

export const vehicleSchema = z.object({
  name: z.string().trim().min(1).max(100),
  licensePlate: z.string().trim().min(1).max(12).transform((v) => v.toUpperCase()),
  gearbox: z.enum(["MANUAL", "AUTOMATIC"]),
  color: text(40),
  dualControl: z.boolean(),
  status: z.enum(["ACTIVE", "IN_MAINTENANCE", "RETIRED"]),
  apkDueDate: dateText,
  nextServiceDate: dateText,
  insuranceDueDate: dateText,
  odometerKm: z.union([z.number().int().min(0).max(2_000_000), z.nan(), z.literal("")]).optional().transform((v) => (typeof v === "number" && !Number.isNaN(v) ? v : undefined)),
  assignedInstructorId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
});
export type VehicleInput = z.input<typeof vehicleSchema>;
export type VehicleData = z.output<typeof vehicleSchema>;

export const instructorSchema = z.object({
  displayName: z.string().trim().min(1).max(60),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  licenceNumber: text(40),
  maxMinutesPerDay: z.number().int().min(60).max(960),
  homeAddress: text(200),
  defaultVehicleId: z.string().optional().or(z.literal("")).transform((v) => v || undefined),
});
export type InstructorInput = z.input<typeof instructorSchema>;

export const workingHoursSchema = z.array(
  z.object({ weekday: z.number().int().min(1).max(7), startMin: z.number().int().min(0).max(1439), endMin: z.number().int().min(1).max(1440) })
    .refine((r) => r.endMin > r.startMin),
);

export const timeOffSchema = z.object({ startsAt: z.string(), endsAt: z.string(), reason: text(200) });

export const packageSchema = z.object({
  nameNl: z.string().trim().min(1).max(80),
  nameEn: z.string().trim().min(1).max(80),
  descriptionNl: text(120),
  descriptionEn: text(120),
  type: z.enum(["PRACTICAL", "THEORY", "EXAM_BUNDLE"]),
  lessonCount: z.number().int().min(1).max(200),
  /** euros as typed by the admin; converted to integer cents on the server */
  priceEuros: z.number().min(0).max(100000),
  vatRate: z.number().int().min(0).max(30),
  includesExam: z.boolean(),
  isPopular: z.boolean(),
  active: z.boolean(),
  sortOrder: z.number().int().min(0).max(999),
});
export type PackageInput = z.input<typeof packageSchema>;

export const schoolFormSchema = z.object({
  name: z.string().trim().min(1).max(100),
  address: text(),
  postcode: text(20),
  city: text(80),
  kvk: text(30),
  btw: text(30),
  iban: text(40),
  defaultLocale: z.enum(["nl", "en"]),
  settings: schoolSettingsSchema.partial(),
});
export type SchoolFormInput = z.input<typeof schoolFormSchema>;
