import { Resend } from "resend";

export type EmailAttachment = { filename: string; content: string | Uint8Array; contentType: string };
export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  fromName?: string;
  attachments?: EmailAttachment[];
};

export interface EmailProvider {
  send(msg: EmailMessage): Promise<{ id: string }>;
}

/** Used when RESEND_API_KEY is missing, so the app runs fully locally. */
class ConsoleEmailProvider implements EmailProvider {
  async send(msg: EmailMessage) {
    const att = msg.attachments?.length ? ` attachments=${msg.attachments.map((a) => a.filename).join(",")}` : "";
    console.log(`[email:mock] to=${msg.to} subject="${msg.subject}"${att}\n${msg.text}`);
    return { id: `mock-${Date.now()}` };
  }
}

class ResendEmailProvider implements EmailProvider {
  private client: Resend;
  constructor(key: string) {
    this.client = new Resend(key);
  }
  async send(msg: EmailMessage) {
    const from = `${msg.fromName ?? "Shaakir Rijschool"} <${process.env.EMAIL_FROM ?? "noreply@example.com"}>`;
    const { data, error } = await this.client.emails.send({
      from, to: msg.to, subject: msg.subject, text: msg.text, html: msg.html,
      attachments: msg.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content), contentType: a.contentType })),
    });
    if (error) throw new Error(error.message);
    return { id: data?.id ?? "" };
  }
}

export function getEmailProvider(): EmailProvider {
  const key = process.env.RESEND_API_KEY;
  return key ? new ResendEmailProvider(key) : new ConsoleEmailProvider();
}
