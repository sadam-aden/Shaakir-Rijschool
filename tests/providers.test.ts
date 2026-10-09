import { afterEach, describe, expect, it, vi } from "vitest";
import { getPaymentProvider, toPaymentStatus } from "@/lib/providers/payments";
import { cleanSender, getSmsProvider, smsProviderName } from "@/lib/providers/sms";

afterEach(() => vi.unstubAllGlobals());

const jsonResponse = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

describe("payment provider selection", () => {
  it("uses the local mock without a Mollie key and links to the mock checkout page", async () => {
    const p = getPaymentProvider({});
    expect(p.name).toBe("mock");
    const r = await p.createPayment({ amountCents: 5000, description: "x", redirectUrl: "http://localhost:3000/pay/return", metadata: {} });
    expect(r.id).toMatch(/^mock_/);
    expect(r.checkoutUrl).toBe(`http://localhost:3000/pay/mock/${r.id}`);
  });
  it("calls Mollie with iDEAL, a decimal amount and the metadata", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ id: "tr_abc", status: "open", _links: { checkout: { href: "https://www.mollie.com/checkout/x" } } }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const p = getPaymentProvider({ MOLLIE_API_KEY: "test_123" });
    const r = await p.createPayment({ amountCents: 59500, description: "Factuur 2026-0001", redirectUrl: "https://app.nl/pay/return", webhookUrl: "https://app.nl/api/webhooks/mollie", metadata: { invoiceId: "inv1" } });
    expect(r).toEqual({ id: "tr_abc", checkoutUrl: "https://www.mollie.com/checkout/x", status: "open" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.mollie.com/v2/payments");
    expect(init.headers.Authorization).toBe("Bearer test_123");
    expect(JSON.parse(init.body)).toMatchObject({ amount: { currency: "EUR", value: "595.00" }, method: "ideal", metadata: { invoiceId: "inv1" }, webhookUrl: "https://app.nl/api/webhooks/mollie" });
  });
  it("re-fetches a payment from Mollie and surfaces errors", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValueOnce(jsonResponse({ id: "tr_abc", status: "paid", paidAt: "2026-10-09T08:00:00+00:00" })).mockResolvedValueOnce(jsonResponse({ detail: "Not found" }, 404)));
    const p = getPaymentProvider({ MOLLIE_API_KEY: "test_123" });
    const ok = await p.getPayment("tr_abc");
    expect(ok.status).toBe("paid");
    expect(ok.paidAt?.toISOString()).toBe("2026-10-09T08:00:00.000Z");
    await expect(p.getPayment("tr_missing")).rejects.toThrow("Mollie 404: Not found");
  });
  it("maps Mollie statuses to ours", () => {
    expect(toPaymentStatus("paid")).toBe("PAID");
    expect(toPaymentStatus("open")).toBe("PENDING");
    expect(toPaymentStatus("canceled")).toBe("CANCELLED");
    expect(toPaymentStatus("expired")).toBe("EXPIRED");
    expect(toPaymentStatus("failed")).toBe("FAILED");
  });
});

describe("SMS providers", () => {
  it("falls back to the console mock when keys are missing", () => {
    expect(smsProviderName({})).toBe("mock");
    expect(smsProviderName({ SMS_PROVIDER: "twilio" })).toBe("mock");
    expect(smsProviderName({ SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t" })).toBe("twilio");
    expect(smsProviderName({ SMS_PROVIDER: "bird", BIRD_API_KEY: "k" })).toBe("bird");
  });
  it("keeps the alphanumeric sender within 11 characters", () => {
    expect(cleanSender("ShaakirRS")).toBe("ShaakirRS");
    expect(cleanSender("Shaakir Rijschool!")).toBe("Shaakir Rij");
  });
  it("sends through Twilio with basic auth and the sender name", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ sid: "SM123" }, 201));
    vi.stubGlobal("fetch", fetchMock);
    const r = await getSmsProvider({ SMS_PROVIDER: "twilio", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "tok" }).send({ to: "+31612345678", body: "Hallo", sender: "ShaakirRS" });
    expect(r.id).toBe("SM123");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    expect(init.headers.Authorization).toBe(`Basic ${Buffer.from("AC1:tok").toString("base64")}`);
    expect(String(init.body)).toContain("From=ShaakirRS");
    expect(String(init.body)).toContain("To=%2B31612345678");
  });
  it("sends through Bird and reports provider errors", async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ id: "b1" }, 201)).mockResolvedValueOnce(jsonResponse({ errors: [{ description: "Bad number" }] }, 422));
    vi.stubGlobal("fetch", fetchMock);
    const p = getSmsProvider({ SMS_PROVIDER: "bird", BIRD_API_KEY: "key" });
    expect((await p.send({ to: "+31612345678", body: "Hi", sender: "ShaakirRS" })).id).toBe("b1");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).recipients).toEqual(["31612345678"]);
    await expect(p.send({ to: "+31612345678", body: "Hi", sender: "ShaakirRS" })).rejects.toThrow("Bird: Bad number");
  });
});
