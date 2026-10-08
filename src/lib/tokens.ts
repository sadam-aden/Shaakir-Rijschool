import { createHash, randomBytes } from "node:crypto";

/** Random URL-safe token; only its SHA-256 hash is stored in the database. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, hash: hashToken(token) };
}

export function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}
