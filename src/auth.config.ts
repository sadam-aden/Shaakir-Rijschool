import type { NextAuthConfig } from "next-auth";

/** Edge-safe part of the Auth.js config (no database access) — used by proxy.ts. */
export const authConfig = {
  pages: { signIn: "/login" },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const path = request.nextUrl.pathname;
      const isPublic = path.startsWith("/login") || path.startsWith("/uitnodiging") || path.startsWith("/api/webhooks");
      if (isPublic) return true;
      return !!auth?.user;
    },
    jwt({ token, user }) {
      if (user) {
        token.uid = user.id;
        token.role = user.role;
        token.schoolId = user.schoolId;
        token.instructorId = user.instructorId ?? null;
      }
      return token;
    },
    session({ session, token }) {
      session.user.id = token.uid as string;
      session.user.role = token.role as "ADMIN" | "INSTRUCTOR";
      session.user.schoolId = token.schoolId as string;
      session.user.instructorId = (token.instructorId as string | null) ?? null;
      return session;
    },
  },
} satisfies NextAuthConfig;
