jest.mock('nodemailer');

import {
  BadRequestException,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createTransport } from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { MailService } from './mail.service';

const VALIDATION_SUBJECT = 'Seu código de validação — Digitaly Telemedicine';

interface MailPayload {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
}

interface TransportDouble {
  transporter: Transporter;
  sendMail: jest.Mock<Promise<{ messageId: string }>, [MailPayload]>;
}

type CreateTransportMock = jest.Mock<Transporter, [Record<string, unknown>]>;

const mockedCreateTransport = createTransport as unknown as CreateTransportMock;

function createTransportDouble(): TransportDouble {
  const sendMail = jest.fn<Promise<{ messageId: string }>, [MailPayload]>();
  const transporter = { sendMail } as unknown as Transporter;
  return { transporter, sendMail };
}

function createConfig(
  overrides: Record<string, string | number> = {},
): ConfigService {
  return new ConfigService({
    MAIL_HOST: 'localhost',
    MAIL_PORT: 1025,
    MAIL_USER: '',
    MAIL_PASSWORD: '',
    MAIL_FROM: 'no-reply@digitaly.health',
    ...overrides,
  });
}

function createService(
  overrides: Record<string, string | number> = {},
): MailService {
  return new MailService(createConfig(overrides));
}

function captureOutput(): { output: string[]; restore: () => void } {
  const output: string[] = [];
  const collect = (...args: unknown[]): void => {
    output.push(args.map((arg) => String(arg)).join(' '));
  };
  const spies: jest.SpyInstance[] = [
    jest.spyOn(Logger.prototype, 'log').mockImplementation(collect),
    jest.spyOn(Logger.prototype, 'error').mockImplementation(collect),
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(collect),
    jest.spyOn(Logger.prototype, 'debug').mockImplementation(collect),
    jest.spyOn(Logger.prototype, 'verbose').mockImplementation(collect),
    jest.spyOn(console, 'log').mockImplementation(collect),
    jest.spyOn(console, 'error').mockImplementation(collect),
    jest.spyOn(console, 'warn').mockImplementation(collect),
    jest.spyOn(console, 'info').mockImplementation(collect),
  ];
  return {
    output,
    restore: (): void => {
      for (const spy of spies) {
        spy.mockRestore();
      }
    },
  };
}

describe('MailService', () => {
  beforeEach(() => {
    mockedCreateTransport.mockReset();
  });

  it('sends a pt-BR validation code email with text and html parts', async () => {
    const { transporter, sendMail } = createTransportDouble();
    sendMail.mockResolvedValue({ messageId: 'message-1' });
    mockedCreateTransport.mockReturnValue(transporter);

    const service = createService();
    await service.sendValidationCode('patient@example.test', '123456', 10);

    expect(mockedCreateTransport).toHaveBeenCalledTimes(1);
    expect(sendMail).toHaveBeenCalledTimes(1);

    const payload = sendMail.mock.calls[0][0];
    expect(payload.from).toBe('no-reply@digitaly.health');
    expect(payload.to).toBe('patient@example.test');
    expect(payload.subject).toBe(VALIDATION_SUBJECT);
    expect(payload.text).toContain('123456');
    expect(payload.text).toContain('10');
    expect(payload.html).toContain('123456');
    expect(payload.html).toContain('10');
  });

  it('omits auth when MAIL_USER is blank', async () => {
    const { transporter, sendMail } = createTransportDouble();
    sendMail.mockResolvedValue({ messageId: 'message-2' });
    mockedCreateTransport.mockReturnValue(transporter);

    const service = createService();
    await service.sendValidationCode('patient@example.test', '123456', 10);

    const options = mockedCreateTransport.mock.calls[0][0];
    expect(options).toMatchObject({ host: 'localhost', port: 1025 });
    expect(options).not.toHaveProperty('auth');
  });

  it('includes auth when MAIL_USER is set', async () => {
    const { transporter, sendMail } = createTransportDouble();
    sendMail.mockResolvedValue({ messageId: 'message-3' });
    mockedCreateTransport.mockReturnValue(transporter);

    const service = createService({
      MAIL_USER: 'mailer',
      MAIL_PASSWORD: 'secret',
    });
    await service.sendValidationCode('patient@example.test', '123456', 10);

    const options = mockedCreateTransport.mock.calls[0][0];
    expect(options).toMatchObject({
      auth: { user: 'mailer', pass: 'secret' },
    });
  });

  it('rejects empty recipient or code without sending', async () => {
    const { transporter, sendMail } = createTransportDouble();
    mockedCreateTransport.mockReturnValue(transporter);
    const service = createService();

    await expect(
      service.sendValidationCode('   ', '123456', 10),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.sendValidationCode('patient@example.test', '   ', 10),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(sendMail).not.toHaveBeenCalled();
  });

  it('does not log the code or recipient on success', async () => {
    const { output, restore } = captureOutput();
    try {
      const { transporter, sendMail } = createTransportDouble();
      sendMail.mockResolvedValue({ messageId: 'message-4' });
      mockedCreateTransport.mockReturnValue(transporter);

      await createService().sendValidationCode(
        'patient@example.test',
        '123456',
        10,
      );

      expect(output.join('\n')).not.toContain('123456');
      expect(output.join('\n')).not.toContain('patient@example.test');
    } finally {
      restore();
    }
  });

  it('throws a generic 503 on transport failure without logging PII', async () => {
    const { output, restore } = captureOutput();
    try {
      const { transporter, sendMail } = createTransportDouble();
      sendMail.mockRejectedValue(
        new Error('550 mailbox patient@example.test unavailable, code 123456'),
      );
      mockedCreateTransport.mockReturnValue(transporter);

      const error = await createService()
        .sendValidationCode('patient@example.test', '123456', 10)
        .catch((caught: unknown) => caught);

      expect(error).toBeInstanceOf(ServiceUnavailableException);
      expect((error as ServiceUnavailableException).getStatus()).toBe(503);

      const logged = output.join('\n');
      expect(logged).not.toContain('123456');
      expect(logged).not.toContain('patient@example.test');
      expect(logged).not.toContain('550');
    } finally {
      restore();
    }
  });
});
