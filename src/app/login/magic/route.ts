import { NextResponse, type NextRequest } from "next/server";
import { signIn } from "@/auth";

/** Magic-link landing: exchanges the single-use token for a session. */
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  try {
    await signIn("magic-link", { token, redirectTo: "/" });
  } catch (e) {
    // signIn throws a redirect on success; rethrow it. Only real errors fall through.
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    if (typeof e === "object" && e && "digest" in e) throw e;
  }
  return NextResponse.redirect(new URL("/login?error=link", req.url));
}
