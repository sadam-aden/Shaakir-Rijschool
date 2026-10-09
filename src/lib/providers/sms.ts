export type SmsMessage = { to: string; body: string; sender: string };

export interface SmsProvider {
  send(msg: SmsMessage): Promise<{ id: string }>;
}

/** Alphanumeric sender ids are max 11 characters, letters/digits/space only. */
export const cleanSender = (s: string) => s.replace(/[^A-Za-z0-9 ]/g, "").slice(0, 11) || "RijSchool";

/** Console implementation, used when no SMS provider is configured. */
class ConsoleSmsProvider implements SmsProvider {
  async send(msg: SmsMessage) {
    console.log(`[sms:mock] from=${msg.sender} to=${msg.to}\n${msg.body}`);
    return { id: `mock-${Date.now()}` };
  }
}

/** Twilio Programmable Messaging (REST, no SDK). SMS_PROVIDER=twilio */
class TwilioSmsProvider implements SmsProvider {
  constructor(private sid: string, private token: string) {}
  async send(msg: SmsMessage) {
    const r = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${this.sid}/Messages.json`, {
      method: "POST",
      headers: { Authorization: `Basic ${Buffer.from(`${this.sid}:${this.token}`).toString("base64")}`, "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: msg.to, From: cleanSender(msg.sender), Body: msg.body }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as { sid?: string; message?: string };
    if (!r.ok || !j.sid) throw new Error(`Twilio: ${j.message ?? r.status}`);
    return { id: j.sid };
  }
}

/** Bird / MessageBird REST API. SMS_PROVIDER=bird */
class BirdSmsProvider implements SmsProvider {
  constructor(private key: string) {}
  async send(msg: SmsMessage) {
    const r = await fetch("https://rest.messagebird.com/messages", {
      method: "POST",
      headers: { Authorization: `AccessKey ${this.key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ originator: cleanSender(msg.sender), recipients: [msg.to.replace(/^\+/, "")], body: msg.body }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as { id?: string; errors?: { description?: string }[] };
    if (!r.ok || !j.id) throw new Error(`Bird: ${j.errors?.[0]?.description ?? r.status}`);
    return { id: j.id };
  }
}

/** Picks the provider from the environment; falls back to the console mock when keys are missing. */
export function getSmsProvider(env: Record<string, string | undefined> = process.env): SmsProvider {
  if (env.SMS_PROVIDER === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN) {
    return new TwilioSmsProvider(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }
  if (env.SMS_PROVIDER === "bird" && env.BIRD_API_KEY) return new BirdSmsProvider(env.BIRD_API_KEY);
  return new ConsoleSmsProvider();
}

export const smsProviderName = (env: Record<string, string | undefined> = process.env): "twilio" | "bird" | "mock" =>
  env.SMS_PROVIDER === "twilio" && env.TWILIO_ACCOUNT_SID && env.TWILIO_AUTH_TOKEN ? "twilio" : env.SMS_PROVIDER === "bird" && env.BIRD_API_KEY ? "bird" : "mock";
