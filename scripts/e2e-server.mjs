// Starts an isolated production build for Playwright: own dist dir (.next-e2e), own port and the *_test database,
// so end-to-end runs never touch the dev database or collide with a running `npm run dev`.
import { spawn, spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { e2eDatabaseUrl } from "../tests/e2e/db-url.mjs";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const next = path.join(root, "node_modules", "next", "dist", "bin", "next");
const env = {
  ...process.env,
  DATABASE_URL: e2eDatabaseUrl(),
  NEXT_DIST_DIR: ".next-e2e",
  AUTH_SECRET: process.env.AUTH_SECRET ?? "e2e-secret-0123456789abcdef0123456789",
  AUTH_TRUST_HOST: "true",
  APP_URL: "http://localhost:3100",
};

if (!process.env.E2E_SKIP_BUILD) {
  const b = spawnSync(process.execPath, [next, "build"], { stdio: "inherit", env, cwd: root });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const child = spawn(process.execPath, [next, "start", "-p", "3100"], { stdio: "inherit", env, cwd: root });
child.on("exit", (c) => process.exit(c ?? 0));
