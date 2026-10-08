import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import { parseSettings } from "@/lib/schemas/settings";

export const getSchoolSettings = cache(async (schoolId: string) => {
  const school = await db.school.findUniqueOrThrow({ where: { id: schoolId } });
  return { school, settings: parseSettings(school.settings) };
});
