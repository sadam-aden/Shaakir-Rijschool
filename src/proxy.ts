import NextAuth from "next-auth";
import { authConfig } from "./auth.config";

// Optimistic check only (redirect to /login). Real authorization happens in src/lib/dal.
export default NextAuth(authConfig).auth;

export const config = {
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|svg|ico|webp)$).*)"],
};
