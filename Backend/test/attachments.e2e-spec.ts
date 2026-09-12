import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import type {
  AttachmentDto,
  AuthResponseDto,
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
const OTHER_PATIENT_EMAIL = 'paciente2@digitaly.health';
const CONFIRMED_APPOINTMENT_ID = 'a0000000-0000-4000-8000-000000000002';
const DEFAULT_MAX_BYTES = 10_485_760;

const mailStub = {
  sendValidationCode: jest.fn().mockResolvedValue(undefined),
};

describe('Attachments (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;
  let storage: StorageService;

  let doctorToken = '';
  let patientToken = '';
  let otherPatientToken = '';
  let patientId = '';
  let firstAttachmentId = '';

  const createdAttachmentIds: string[] = [];
  const textPayload = Buffer.from('digitaly attachment e2e payload');

  const login = async (email: string): Promise<AuthResponseDto> => {
    const response = await request(app.getHttpServer())
      .post('/api/auth/login')
      .send({ email, password: DEMO_PASSWORD })
      .expect(200);
    return response.body as AuthResponseDto;
  };

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

    const doctor = await login(DOCTOR_EMAIL);
    doctorToken = doctor.tokens.accessToken;

    const patient = await login(PATIENT_EMAIL);
    patientToken = patient.tokens.accessToken;
    patientId = patient.user.id;

    const otherPatient = await login(OTHER_PATIENT_EMAIL);
    otherPatientToken = otherPatient.tokens.accessToken;
  });

  afterAll(async () => {
    if (prisma && createdAttachmentIds.length > 0) {
      const rows = await prisma.attachment.findMany({
        where: { id: { in: createdAttachmentIds } },
        select: { storageKey: true },
      });
      for (const row of rows) {
        await storage.remove(row.storageKey);
      }
      await prisma.attachment.deleteMany({
        where: { id: { in: createdAttachmentIds } },
      });
    }

    if (app) {
      await app.close();
    }
  });

  it('uploads a text attachment for a participant', async () => {
    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${patientToken}`)
      .attach('file', textPayload, {
        filename: 'exame.txt',
        contentType: 'text/plain',
      })
      .expect(201);

    const body = response.body as AttachmentDto;
    firstAttachmentId = body.id;
    createdAttachmentIds.push(body.id);

    expect(body).toMatchObject({
      appointmentId: CONFIRMED_APPOINTMENT_ID,
      consultationId: null,
      uploaderId: patientId,
      fileName: 'exame.txt',
      contentType: 'text/plain',
      sizeBytes: textPayload.length,
      kind: 'document',
      downloadUrl: `/api/attachments/${body.id}`,
    });
    expect(new Date(body.createdAt).getTime()).not.toBeNaN();
  });

  it('lists the attachment for a participant', async () => {
    const response = await request(app.getHttpServer())
      .get(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);

    const attachments = response.body as AttachmentDto[];
    const found = attachments.find(
      (attachment) => attachment.id === firstAttachmentId,
    );
    expect(found).toBeDefined();
    expect(found).toMatchObject({
      fileName: 'exame.txt',
      contentType: 'text/plain',
      kind: 'document',
    });
  });

  it('downloads the exact bytes with safe headers', async () => {
    expect(firstAttachmentId).not.toBe('');
    const response = await request(app.getHttpServer())
      .get(`/api/attachments/${firstAttachmentId}`)
      .set('Authorization', `Bearer ${patientToken}`)
      .expect(200);

    expect(response.headers['content-type']).toContain('text/plain');
    expect(response.headers['content-length']).toBe(
      textPayload.length.toString(),
    );
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-disposition']).toBe(
      'inline; filename="exame.txt"',
    );
    expect(Buffer.from(response.text, 'utf8').equals(textPayload)).toBe(true);
  });

  it('classifies an image upload', async () => {
    const pngPayload = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x01, 0x02, 0x03,
    ]);

    const response = await request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${patientToken}`)
      .attach('file', pngPayload, {
        filename: 'lesao.png',
        contentType: 'image/png',
      })
      .expect(201);

    const body = response.body as AttachmentDto;
    createdAttachmentIds.push(body.id);
    expect(body).toMatchObject({
      fileName: 'lesao.png',
      contentType: 'image/png',
      sizeBytes: pngPayload.length,
      kind: 'image',
    });

    const download = await request(app.getHttpServer())
      .get(body.downloadUrl)
      .set('Authorization', `Bearer ${doctorToken}`)
      .expect(200);
    expect(download.headers['content-type']).toContain('image/png');
    expect(download.headers['content-length']).toBe(
      pngPayload.length.toString(),
    );
  });

  it('forbids another patient from uploading', () => {
    return request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${otherPatientToken}`)
      .attach('file', textPayload, {
        filename: 'intruso.txt',
        contentType: 'text/plain',
      })
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('forbids another patient from listing', () => {
    return request(app.getHttpServer())
      .get(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${otherPatientToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('forbids another patient from downloading', () => {
    expect(firstAttachmentId).not.toBe('');
    return request(app.getHttpServer())
      .get(`/api/attachments/${firstAttachmentId}`)
      .set('Authorization', `Bearer ${otherPatientToken}`)
      .expect(403)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FORBIDDEN' });
      });
  });

  it('rejects an oversized upload with 413 FILE_TOO_LARGE', () => {
    const oversized = Buffer.alloc(DEFAULT_MAX_BYTES + 1);
    return request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${patientToken}`)
      .attach('file', oversized, {
        filename: 'grande.bin',
        contentType: 'text/plain',
      })
      .expect(413)
      .expect((response) => {
        expect(response.body).toMatchObject({ error: 'FILE_TOO_LARGE' });
      });
  });

  it('rejects a disallowed type with 415 UNSUPPORTED_MEDIA_TYPE', () => {
    return request(app.getHttpServer())
      .post(`/api/appointments/${CONFIRMED_APPOINTMENT_ID}/attachments`)
      .set('Authorization', `Bearer ${patientToken}`)
      .attach('file', Buffer.from('zip'), {
        filename: 'arquivo.zip',
        contentType: 'application/zip',
      })
      .expect(415)
      .expect((response) => {
        expect(response.body).toMatchObject({
          error: 'UNSUPPORTED_MEDIA_TYPE',
        });
      });
  });
});
