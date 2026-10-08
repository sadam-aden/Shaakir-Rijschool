import { spawnSync } from "node:child_process";
import pg from "pg";
import { adminDatabaseUrl, e2eDatabaseUrl } from "./db-url.mjs";

/** Creates the *_test database if needed, migrates it and loads the demo seed (fresh state for every run). */
export default async function globalSetup() {
  const url = e2eDatabaseUrl();
  const name = new URL(url).pathname.slice(1);
  const admin = new pg.Client({ connectionString: adminDatabaseUrl() });
  await admin.connect();
  const exists = await admin.query("select 1 from pg_database where datname = $1", [name]);
  if (exists.rowCount === 0) await admin.query(`create database "${name}"`);
  await admin.end();

  const env = { ...process.env, DATABASE_URL: url, NODE_ENV: "development" as const };
  const sh = process.platform === "win32";
  for (const args of [["prisma", "migrate", "deploy"], ["tsx", "prisma/seed.ts"]]) {
    const r = spawnSync("npx", args, { env, stdio: "inherit", shell: sh });
    if (r.status !== 0) throw new Error(`${args.join(" ")} failed`);
  }
}
