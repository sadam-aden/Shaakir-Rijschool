import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * File storage for generated files (invoice PDFs). Locally it writes to the git-ignored `storage/` folder.
 * Production: implement this interface on object storage (e.g. Vercel Blob / S3) — Vercel's filesystem is read-only,
 * so there the PDFs are simply rendered on demand (nothing breaks if `put` is not available).
 */
export interface FileStorage {
  put(key: string, data: Uint8Array): Promise<void>;
  get(key: string): Promise<Uint8Array | null>;
}

const ROOT = path.resolve(process.env.STORAGE_DIR ?? "storage");
const safe = (key: string) => {
  const p = path.resolve(ROOT, key);
  if (!p.startsWith(ROOT + path.sep)) throw new Error("invalid storage key");
  return p;
};

export const storage: FileStorage = {
  async put(key, data) {
    const p = safe(key);
    await mkdir(path.dirname(p), { recursive: true });
    await writeFile(p, data);
  },
  async get(key) {
    try {
      return await readFile(safe(key));
    } catch {
      return null;
    }
  },
};
