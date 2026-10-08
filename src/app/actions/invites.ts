"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { requireAdmin } from "@/lib/dal/session";
import { getEmailProvider } from "@/lib/providers/email";
import { hashToken, newToken } from "@/lib/tokens";

const inviteSchema = z.object({ email: z.string().email(), name: z.string().min(1).max(100) });

/** Admin only: invites an instructor by e-mail (link valid for 7 days). */
export async function inviteInstructorAction(input: z.infer<typeof inviteSchema>) {
  const admin = await requireAdmin();
  const data = inviteSchema.parse(input);
  const email = data.email.toLowerCase();
  if (await db.user.findUnique({ where: { email } })) return { ok: false as const, error: "exists" as const };

  const { token, hash } = newToken();
  const school = await db.school.findUniqueOrThrow({ where: { id: admin.schoolId } });
  await db.invite.create({
    data: { schoolId: admin.schoolId, email, role: "INSTRUCTOR", tokenHash: hash, invitedById: admin.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
  });
  await db.auditLog.create({ data: { schoolId: admin.schoolId, userId: admin.id, action: "invite.create", entity: "Invite", data: { email } } });
  const link = `${process.env.APP_URL ?? "http://localhost:3000"}/uitnodiging/${token}?name=${encodeURIComponent(data.name)}`;
  await getEmailProvider().send({
    to: email,
    fromName: school.name,
    subject: `Uitnodiging voor ${school.name} · RijSchool Planner`,
    text: `Je bent uitgenodigd als instructeur bij ${school.name}.\nMaak je account aan (7 dagen geldig):\n${link}`,
  });
  return { ok: true as const };
}

const acceptSchema = z.object({
  token: z.string().min(10),
  name: z.string().min(1).max(100),
  password: z.string().min(10).max(200),
});

export async function acceptInviteAction(_prev: { error?: string } | undefined, formData: FormData) {
  const parsed = acceptSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid" };
  const invite = await db.invite.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return { error: "expired" };

  const passwordHash = await bcrypt.hash(parsed.data.password, 10);
  await db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: { schoolId: invite.schoolId, email: invite.email, name: parsed.data.name, role: invite.role, passwordHash, locale: "nl" },
    });
    await tx.instructor.create({ data: { schoolId: invite.schoolId, userId: user.id, displayName: parsed.data.name.split(" ")[0] } });
    await tx.invite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  });
  redirect("/login");
}
