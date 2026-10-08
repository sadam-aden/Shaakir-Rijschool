export type SmsMessage = { to: string; body: string; sender: string };

export interface SmsProvider {
  send(msg: SmsMessage): Promise<{ id: string }>;
}

/** Console implementation, used until a real provider (Twilio / Bird, Phase 2) is configured. */
class ConsoleSmsProvider implements SmsProvider {
  async send(msg: SmsMessage) {
    console.log(`[sms:mock] from=${msg.sender} to=${msg.to}\n${msg.body}`);
    return { id: `mock-${Date.now()}` };
  }
}

export function getSmsProvider(): SmsProvider {
  return new ConsoleSmsProvider();
}
