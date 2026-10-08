/**
 * Server actions return this instead of throwing, so the UI can show a translated toast.
 * `error` is a key under "errors" in the message files.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T }
  | { ok: false; error: string; params?: Record<string, string | number> };

export function ok(): ActionResult<undefined>;
export function ok<T>(data: T): ActionResult<T>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function ok(data?: unknown): ActionResult<any> {
  return { ok: true, data };
}

export const fail = (error: string, params?: Record<string, string | number>) => ({ ok: false as const, error, params });
