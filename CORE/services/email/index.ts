import { Resend } from 'resend';
import { config } from '../../config/index.js';
import { logger } from '../logger/index.js';

export interface EmailAttachment {
  filename: string;
  content: Buffer | string;
}

export interface EmailPayload {
  to: string | string[];
  subject: string;
  html: string;
  attachments?: EmailAttachment[];
}

export interface EmailProvider {
  send(payload: EmailPayload): Promise<void>;
}

class ResendEmailProvider implements EmailProvider {
  private readonly client: Resend;

  constructor() {
    this.client = new Resend(config.email.resendApiKey);
  }

  async send(payload: EmailPayload): Promise<void> {
    const { error } = await this.client.emails.send({
      from: config.email.from,
      to: payload.to,
      subject: payload.subject,
      html: payload.html,
      attachments: payload.attachments?.map((attachment) => ({
        filename: attachment.filename,
        content: attachment.content,
      })),
    });

    if (error) {
      logger.error({ error, subject: payload.subject }, 'Email send failed');
      throw new Error(`Email delivery failed: ${error.message}`);
    }

    logger.info({ to: payload.to, subject: payload.subject }, 'Email sent');
  }
}

export const emailService: EmailProvider = new ResendEmailProvider();
