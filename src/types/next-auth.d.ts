import type { DefaultSession } from "next-auth";

type AppRole = "ADMIN" | "INSTRUCTOR";

declare module "next-auth" {
  interface User {
    role: AppRole;
    schoolId: string;
    instructorId?: string | null;
  }
  interface Session {
    user: {
      id: string;
      role: AppRole;
      schoolId: string;
      instructorId: string | null;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    uid?: string;
    role?: AppRole;
    schoolId?: string;
    instructorId?: string | null;
  }
}
