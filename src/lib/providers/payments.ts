import { mollieAmount } from "@/lib/domain/money";

export type ProviderPaymentStatus = "open" | "pending" | "paid" | "failed" | "canceled" | "expired";

export type CreatePaymentInput = {
  amountCents: number;
  description: string;
  redirectUrl: string;
  /** Mollie only calls webhooks on public URLs; omitted on localhost (status is then synced when the student returns) */
  webhookUrl?: string;
  metadata: Record<string, string>;
};

export interface PaymentProvider {
  readonly name: "mollie" | "mock";
  createPayment(input: CreatePaymentInput): Promise<{ id: string; checkoutUrl: string; status: ProviderPaymentStatus }>;
  getPayment(id: string): Promise<{ id: string; status: ProviderPaymentStatus; paidAt: Date | null }>;
}

const API = "https://api.mollie.com/v2";

/** Mollie iDEAL (REST, no SDK). A `test_…` key runs in Mollie's test mode. */
class MolliePaymentProvider implements PaymentProvider {
  readonly name = "mollie" as const;
  constructor(private key: string) {}

  private async call<T>(path: string, init?: RequestInit): Promise<T> {
    const r = await fetch(`${API}${path}`, {
      ...init,
      headers: { Authorization: `Bearer ${this.key}`, "Content-Type": "application/json", ...(init?.headers ?? {}) },
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as T & { detail?: string };
    if (!r.ok) throw new Error(`Mollie ${r.status}: ${(j as { detail?: string }).detail ?? "request failed"}`);
    return j;
  }

  async createPayment(i: CreatePaymentInput) {
    const j = await this.call<{ id: string; status: ProviderPaymentStatus; _links: { checkout?: { href: string } } }>("/payments", {
      method: "POST",
      body: JSON.stringify({
        amount: mollieAmount(i.amountCents), description: i.description, redirectUrl: i.redirectUrl,
        ...(i.webhookUrl ? { webhookUrl: i.webhookUrl } : {}), method: "ideal", metadata: i.metadata,
      }),
    });
    if (!j._links.checkout) throw new Error("Mollie returned no checkout link");
    return { id: j.id, checkoutUrl: j._links.checkout.href, status: j.status };
  }

  async getPayment(id: string) {
    const j = await this.call<{ id: string; status: ProviderPaymentStatus; paidAt?: string }>(`/payments/${encodeURIComponent(id)}`);
    return { id: j.id, status: j.status, paidAt: j.paidAt ? new Date(j.paidAt) : null };
  }
}

/**
 * Used without MOLLIE_API_KEY so the whole flow works locally: the "checkout" is our own /pay/mock page where
 * the payment can be marked as paid or failed. State lives in the Payment row, so there is nothing to fetch.
 */
class MockPaymentProvider implements PaymentProvider {
  readonly name = "mock" as const;
  async createPayment(i: CreatePaymentInput) {
    const id = `mock_${crypto.randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const base = new URL(i.redirectUrl).origin;
    return { id, checkoutUrl: `${base}/pay/mock/${id}`, status: "open" as const };
  }
  async getPayment(id: string) {
    return { id, status: "open" as const, paidAt: null };
  }
}

export function getPaymentProvider(env: Record<string, string | undefined> = process.env): PaymentProvider {
  return env.MOLLIE_API_KEY ? new MolliePaymentProvider(env.MOLLIE_API_KEY) : new MockPaymentProvider();
}

/** Mollie status → our PaymentStatus */
export function toPaymentStatus(s: ProviderPaymentStatus): "PENDING" | "PAID" | "FAILED" | "CANCELLED" | "EXPIRED" {
  switch (s) {
    case "paid": return "PAID";
    case "failed": return "FAILED";
    case "canceled": return "CANCELLED";
    case "expired": return "EXPIRED";
    default: return "PENDING";
  }
}
