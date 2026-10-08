import "dotenv/config";

/** Same server as DATABASE_URL, but the database name gets a `_test` suffix. */
export function e2eDatabaseUrl() {
  const base = process.env.E2E_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!base) throw new Error("DATABASE_URL is not set");
  const u = new URL(base);
  const name = u.pathname.replace(/^\//, "");
  if (!process.env.E2E_DATABASE_URL && !name.endsWith("_test")) u.pathname = `/${name}_test`;
  return u.toString();
}

export function adminDatabaseUrl() {
  const u = new URL(e2eDatabaseUrl());
  u.pathname = "/postgres";
  u.search = "";
  return u.toString();
}
