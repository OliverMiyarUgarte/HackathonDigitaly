import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AttachmentDto,
  AuthResponseDto,
  MedicalRecordDto,
} from '@telemed/service-contracts';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { StorageService } from '../src/attachments/storage/storage.service';
import { MailService } from '../src/mail/mail.service';
import { PrismaService } from '../src/prisma/prisma.service';

const DEMO_PASSWORD = 'Demo@1234';
const DOCTOR_EMAIL = 'medico@digitaly.health';
const PATIENT_EMAIL = 'paciente@digitaly.health';
const CONFIRMED_APPOINTMENT_ID = 'a0000000-0000-4000-8000-000000000002';
const MEDICAL_RECORD_ID = 'd0000000-0000-4000-8000-000000000001';
const SEEDED_VALIDATION_CODE = '482913';
const MEDICAL_RECORD_NOTES =
  'Paciente relata palpitacoes em repouso. Exame fisico sem alteracoes. Orientada hidratacao e retorno em 30 dias.';
const MEDICAL_RECORD_DIAGNOSIS = 'Hipertensao arterial sistemica compensada';

const mailStub = {
  sendValidationCode: jest.fn().mockResolvedValue(undefined),
};

describe('Audit trail (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: StorageService;

  const startedAt = new Date();
  const createdAttachmentIds: string[] = [];
  let doctorId = '';
  let doctorToken = '';
  let refreshToken = '';
  let loginCorrelationId = '';

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(MailService)
      .useValue(mailStub)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();

    prisma = app.get(PrismaService);
    storage = app.get(StorageService);

    const loginResponse = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email: DOCTOR_EMAIL, password: DEMO_PASSWORD })
      .expect(200);
    const doctor = loginResponse.body as AuthResponseDto;
    doctorId = doctor.user.id;
    doctorToken = doctor.tokens.accessToken;
    refreshToken = doctor.tokens.refreshToken;
    loginCorrelationId = String(
      loginResponse.headers['x-correlation-id'] ?? '',
    );
  });

  afterAll(async () => {
    if (prisma) {
      const rows = await prisma.attachment.findMany({
        where: { id: { in: createdAttachmentIds } },
        select: { storageKey: true },
      });
      for (const row of rows) {
        await storage.remove(row.storageKey);
      }
      if (createdAttachmentIds.length > 0) {
        await prisma.attachment.deleteMany({
          where: { id: { in: createdAttachmentIds } },
        });
      }
      if (doctorId) {
        await prisma.auditLog.deleteMany({
          where: { actorId: doctorId, createdAt: { gte: startedAt } },
        });
        await prisma.refreshToken.deleteMany({
          where: { userId: doctorId, createdAt: { gte: startedAt } },
        });
      }
    }
    if (app) {
      await app.close();
    }
  });

  it('audits a login, a record read and an attachment download without storing PII', async () => {
    expect(loginCorrelationId).not.toBe('');

    const recordResponse = await request(app.getHttpServer())
      .get(`/api/records/${MEDICAL_RECORD_ID}`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect((recordResponse.body as MedicalRecordDto).id).toBe(
      MEDICAL_RECORD_ID,
    );

    const payload = Buffer.from('digitaly audit e2e payload');
    const uploadResponse = await request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .attach('file', payload, {
        filename: 'audit.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const attachment = uploadResponse.body as AttachmentDto;
    createdAttachmentIds.push(attachment.id);

    await request(app.getHttpServer())
      .get(attachment.downloadUrl)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const rows = await prisma.auditLog.findMany({
      where: { actorId: doctorId, createdAt: { gte: startedAt } },
      orderBy: { createdAt: 'asc' },
    });

    const actions = rows.map((row) => row.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'auth.login',
        'medical_record.read',
        'attachment.upload',
        'attachment.download',
      ]),
    );

    const loginRow = rows.find((row) => row.action === 'auth.login');
    expect(loginRow).toMatchObject({
      actorId: doctorId,
      resourceType: 'user',
      resourceId: doctorId,
      metadata: { outcome: 'success', correlationId: loginCorrelationId },
    });

    const serialized = JSON.stringify(rows);
    for (const secret of [
      doctorToken,
      refreshToken,
      DEMO_PASSWORD,
      PATIENT_EMAIL,
      DOCTOR_EMAIL,
      MEDICAL_RECORD_NOTES,
      MEDICAL_RECORD_DIAGNOSIS,
      'Palpitacoes frequentes em repouso',
      SEEDED_VALIDATION_CODE,
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });
});
