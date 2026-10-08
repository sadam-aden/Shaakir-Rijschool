"use server";

import { cookies } from "next/headers";
import { AuthError } from "next-auth";
import { z } from "zod";
import { auth, signIn, signOut } from "@/auth";
import { db } from "@/lib/db";
import { LOCALE_COOKIE, isLocale } from "@/i18n/config";
import { getEmailProvider } from "@/lib/providers/email";
import { rateLimit } from "@/lib/rate-limit";
import { newToken } from "@/lib/tokens";

export type LoginState = { error?: "invalid" | "tooMany"; magicSent?: boolean; email?: string } | undefined;

const loginSchema = z.object({ email: z.string().email(), password: z.string().min(1) });

export async function loginAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "");
  const parsed = loginSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "invalid", email };
  try {
    await signIn("password", { ...parsed.data, redirectTo: "/" });
  } catch (e) {
    if (e instanceof AuthError) {
      const tooMany = String((e as { cause?: { err?: Error } }).cause?.err?.message).includes("TooManyAttempts");
      return { error: tooMany ? "tooMany" : "invalid", email };
    }
    throw e; // redirect
  }
}

/** Always answers the same way so e-mail addresses cannot be probed. */
export async function requestMagicLinkAction(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = z.string().email().safeParse(formData.get("email"));
  if (!parsed.success) return { error: "invalid" };
  const email = parsed.data.toLowerCase();
  if (!rateLimit(`magic:${email}`, 3, 15 * 60_000)) return { error: "tooMany" };
  const user = await db.user.findUnique({ where: { email }, include: { school: true } });
  if (user?.isActive) {
    const { token, hash } = newToken();
    await db.verificationToken.create({
      data: { identifier: email, token: hash, expires: new Date(Date.now() + 15 * 60_000) },
    });
    const base = process.env.APP_URL ?? "http://localhost:3000";
    const link = `${base}/login/magic?token=${token}`;
    const nl = user.locale === "nl";
    await getEmailProvider().send({
      to: email,
      fromName: user.school.name,
      subject: nl ? "Je inloglink voor RijSchool Planner" : "Your RijSchool Planner sign-in link",
      text: nl
        ? `Klik om in te loggen (15 minuten geldig):\n${link}`
        : `Click to sign in (valid for 15 minutes):\n${link}`,
    });
  }
  return { magicSent: true };
}

export async function logoutAction() {
  await signOut({ redirectTo: "/login" });
}

/** Stores the language in a cookie and, when signed in, on the user. */
export async function setLocaleAction(locale: string) {
  if (!isLocale(locale)) return;
  (await cookies()).set(LOCALE_COOKIE, locale, { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
  const session = await auth();
  if (session?.user?.id) await db.user.update({ where: { id: session.user.id }, data: { locale } });
}

