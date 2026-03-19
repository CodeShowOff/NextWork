import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface SendTransactionalEmailParams {
  to: string;
  subject: string;
  htmlContent: string;
  textContent?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  private isMissingOrPlaceholder(value: string | undefined, placeholders: string[]): boolean {
    if (!value) {
      return true;
    }

    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return true;
    }

    return placeholders.some((placeholder) => placeholder.toLowerCase() === normalized);
  }

  async sendTransactionalEmail(params: SendTransactionalEmailParams): Promise<void> {
    const rawApiKey = this.configService.get<string>('BREVO_API_KEY');
    const rawSenderEmail = this.configService.get<string>('BREVO_SENDER_EMAIL');
    const apiKey = this.isMissingOrPlaceholder(rawApiKey, ['your_brevo_api_key'])
      ? undefined
      : rawApiKey?.trim();
    const senderEmail = this.isMissingOrPlaceholder(rawSenderEmail, ['verified_sender@yourdomain.com'])
      ? undefined
      : rawSenderEmail?.trim();
    const senderName = this.configService.get<string>('BREVO_SENDER_NAME') ?? 'Workplace';
    const apiBaseUrl =
      this.configService.get<string>('BREVO_API_BASE_URL')?.replace(/\/+$/, '') ??
      'https://api.brevo.com';

    if (!apiKey || !senderEmail) {
      const isProduction = process.env.NODE_ENV === 'production';
      if (isProduction) {
        throw new Error('Brevo email configuration is missing');
      }

      this.logger.warn(
        `Brevo config missing. Skipping email send in ${process.env.NODE_ENV || 'development'} mode for recipient ${params.to}.`,
      );
      return;
    }

    const response = await fetch(`${apiBaseUrl}/v3/smtp/email`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        accept: 'application/json',
        'api-key': apiKey,
      },
      body: JSON.stringify({
        sender: {
          email: senderEmail,
          name: senderName,
        },
        to: [{ email: params.to }],
        subject: params.subject,
        htmlContent: params.htmlContent,
        ...(params.textContent ? { textContent: params.textContent } : {}),
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      this.logger.error(
        `Brevo send failed with status ${response.status}: ${errorBody || 'empty response'}`,
      );
      throw new Error('Failed to send email');
    }
  }
}