import {
  BadRequestException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';

const VALIDATION_CODE_SUBJECT =
  'Seu código de validação — Digitaly Telemedicine';
const EMAIL_UNAVAILABLE_MESSAGE = 'Email service unavailable';
const DEFAULT_MAIL_HOST = 'localhost';
const DEFAULT_MAIL_PORT = 1025;
const DEFAULT_MAIL_FROM = 'no-reply@digitaly.health';

@Injectable()
export class MailService {
  private readonly transporter: Transporter;
  private readonly from: string;
  private readonly logger = new Logger(MailService.name);

  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('MAIL_HOST', DEFAULT_MAIL_HOST);
    const port = this.configService.get<number>('MAIL_PORT', DEFAULT_MAIL_PORT);
    const user = this.configService.get<string>('MAIL_USER', '').trim();
    const password = this.configService.get<string>('MAIL_PASSWORD', '');
    this.from = this.configService.get<string>('MAIL_FROM', DEFAULT_MAIL_FROM);

    this.transporter = createTransport({
      host,
      port,
      secure: port === 465,
      ...(port === 587
        ? { requireTLS: true, tls: { minVersion: 'TLSv1.2' } }
        : {}),
      ...(user.length > 0 ? { auth: { user, pass: password } } : {}),
    });
  }

  async sendValidationCode(
    to: string,
    code: string,
    expiresInMinutes: number,
  ): Promise<void> {
    const recipient = to.trim();
    const validationCode = code.trim();
    if (recipient.length === 0) {
      throw new BadRequestException('Recipient is required');
    }
    if (validationCode.length === 0) {
      throw new BadRequestException('Validation code is required');
    }

    const text = [
      'Olá,',
      '',
      `Seu código de validação é: ${validationCode}`,
      '',
      `Ele expira em ${expiresInMinutes} minutos.`,
      '',
      'Se você não solicitou este código, ignore este e-mail.',
      '',
      'Digitaly Telemedicine',
    ].join('\n');

    const html = [
      '<p>Olá,</p>',
      '<p>Seu código de validação é:</p>',
      `<p><strong>${validationCode}</strong></p>`,
      `<p>Ele expira em ${expiresInMinutes} minutos.</p>`,
      '<p>Se você não solicitou este código, ignore este e-mail.</p>',
      '<p>Digitaly Telemedicine</p>',
    ].join('');

    await this.send(recipient, VALIDATION_CODE_SUBJECT, text, html);
  }

  private async send(
    to: string,
    subject: string,
    text: string,
    html: string,
  ): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.from,
        to,
        subject,
        text,
        html,
      });
    } catch {
      this.logger.error('Transactional email delivery failed');
      throw new ServiceUnavailableException(EMAIL_UNAVAILABLE_MESSAGE);
    }
  }
}
