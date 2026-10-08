import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { hashToken } from "@/lib/tokens";
import { authConfig } from "./auth.config";

const passwordSchema = z.object({ email: z.string().email(), password: z.string().min(1) });
const magicSchema = z.object({ token: z.string().min(10) });

async function toAuthUser(userId: string) {
  const u = await db.user.findUnique({ where: { id: userId }, include: { instructor: true } });
  if (!u || !u.isActive) return null;
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    role: u.role,
    schoolId: u.schoolId,
    instructorId: u.instructor?.id ?? null,
  };
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      id: "password",
      credentials: { email: {}, password: {} },
      async authorize(raw) {
        const parsed = passwordSchema.safeParse(raw);
        if (!parsed.success) return null;
        const email = parsed.data.email.toLowerCase();
        // 8 attempts per 10 minutes per e-mail address
        if (!rateLimit(`login:${email}`, 8, 10 * 60_000)) throw new Error("TooManyAttempts");
        const user = await db.user.findUnique({ where: { email } });
        if (!user?.passwordHash || !user.isActive) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        return ok ? toAuthUser(user.id) : null;
      },
    }),
    Credentials({
      id: "magic-link",
      credentials: { token: {} },
      async authorize(raw) {
        const parsed = magicSchema.safeParse(raw);
        if (!parsed.success) return null;
        const hash = hashToken(parsed.data.token);
        const row = await db.verificationToken.findUnique({ where: { token: hash } });
        if (!row || row.expires < new Date()) return null;
        // single use
        await db.verificationToken.delete({ where: { token: hash } });
        const user = await db.user.findUnique({ where: { email: row.identifier } });
        return user ? toAuthUser(user.id) : null;
      },
    }),
  ],
});
