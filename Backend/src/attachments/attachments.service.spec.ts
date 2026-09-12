import { ForbiddenException, HttpException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { AttachmentKind } from '@telemed/service-contracts';
import { Readable } from 'node:stream';
import type { ReadStream } from 'node:fs';
import type { AppointmentAccessService } from '../appointments/appointment-access.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Appointment, Attachment } from '../generated/prisma/client';
import type { PrismaService } from '../prisma/prisma.service';
import { AttachmentsService } from './attachments.service';

const PATIENT: AuthenticatedUser = { sub: 'patient-1', role: 'patient' };
const DOCTOR: AuthenticatedUser = { sub: 'doctor-1', role: 'doctor' };
const APPOINTMENT_ID = 'a0000000-0000-4000-8000-000000000001';
const MAX_BYTES = 1024;

interface AttachmentCreateData {
  appointmentId: string;
  consultationId: string | null;
  uploaderId: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  storageKey: string;
}

interface AttachmentCreateArgs {
  data: AttachmentCreateData;
}

interface AttachmentDelegateMock {
  findMany: jest.Mock<Promise<Attachment[]>, [unknown]>;
  findUnique: jest.Mock<Promise<Attachment | null>, [unknown]>;
  create: jest.Mock<Promise<Attachment>, [AttachmentCreateArgs]>;
}

interface ConsultationDelegateMock {
  findFirst: jest.Mock<Promise<{ id: string } | null>, [unknown]>;
}

interface PrismaMock {
  attachment: AttachmentDelegateMock;
  consultation: ConsultationDelegateMock;
}

interface AccessMock {
  assertAppointmentAccess: jest.Mock<
    Promise<Appointment>,
    [AuthenticatedUser, string]
  >;
}

interface StorageMock {
  save: jest.Mock<Promise<void>, [Buffer, string]>;
  createReadStream: jest.Mock<ReadStream, [string]>;
  remove: jest.Mock<Promise<void>, [string]>;
  exists: jest.Mock<Promise<boolean>, [string]>;
}

interface ConfigMock {
  get: jest.Mock<number, [string, number?]>;
}

function createPrismaMock(): PrismaMock {
  return {
    attachment: {
      findMany: jest.fn<Promise<Attachment[]>, [unknown]>(),
      findUnique: jest.fn<Promise<Attachment | null>, [unknown]>(),
      create: jest.fn<Promise<Attachment>, [AttachmentCreateArgs]>(),
    },
    consultation: {
      findFirst: jest.fn<Promise<{ id: string } | null>, [unknown]>(),
    },
  };
}

function createAccessMock(): AccessMock {
  return {
    assertAppointmentAccess: jest.fn<
      Promise<Appointment>,
      [AuthenticatedUser, string]
    >(),
  };
}

function createStorageMock(): StorageMock {
  return {
    save: jest.fn<Promise<void>, [Buffer, string]>(),
    createReadStream: jest.fn<ReadStream, [string]>(),
    remove: jest.fn<Promise<void>, [string]>(),
    exists: jest.fn<Promise<boolean>, [string]>(),
  };
}

function createConfigMock(): ConfigMock {
  return {
    get: jest.fn<number, [string, number?]>(() => MAX_BYTES),
  };
}

function buildAppointment(overrides: Partial<Appointment> = {}): Appointment {
  return {
    id: APPOINTMENT_ID,
    patientId: PATIENT.sub,
    doctorId: DOCTOR.sub,
    scheduledAt: new Date('2026-06-01T10:00:00.000Z'),
    status: 'confirmed',
    cancelReason: null,
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-01T00:00:00.000Z'),
    ...overrides,
  };
}

function buildAttachment(overrides: Partial<Attachment> = {}): Attachment {
  return {
    id: 'attachment-1',
    appointmentId: APPOINTMENT_ID,
    consultationId: null,
    uploaderId: PATIENT.sub,
    fileName: 'laudo.pdf',
    contentType: 'application/pdf',
    sizeBytes: 512,
    kind: 'document',
    storageKey: '11111111-1111-4111-8111-111111111111.pdf',
    createdAt: new Date('2026-02-01T10:00:00.000Z'),
    ...overrides,
  };
}

function buildFile(
  overrides: Partial<Express.Multer.File> = {},
): Express.Multer.File {
  const buffer = overrides.buffer ?? Buffer.from('conteudo');
  return {
    fieldname: 'file',
    originalname: 'laudo.pdf',
    encoding: '7bit',
    mimetype: 'application/pdf',
    size: buffer.length,
    stream: Readable.from(buffer),
    destination: '',
    filename: '',
    path: '',
    buffer,
    ...overrides,
  };
}

function forbidden(): ForbiddenException {
  return new ForbiddenException({
    errorCode: 'FORBIDDEN',
    message: 'Access denied',
  });
}

async function expectHttpError(
  promise: Promise<unknown>,
): Promise<HttpException> {
  try {
    await promise;
  } catch (error) {
    if (error instanceof HttpException) {
      return error;
    }
    throw error;
  }
  throw new Error('Expected request to fail');
}

describe('AttachmentsService', () => {
  let service: AttachmentsService;
  let prisma: PrismaMock;
  let access: AccessMock;
  let storage: StorageMock;
  let config: ConfigMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    access = createAccessMock();
    storage = createStorageMock();
    config = createConfigMock();
    service = new AttachmentsService(
      prisma as unknown as PrismaService,
      access as unknown as AppointmentAccessService,
      storage,
      config as unknown as ConfigService,
    );
    access.assertAppointmentAccess.mockResolvedValue(buildAppointment());
    storage.save.mockResolvedValue(undefined);
    storage.remove.mockResolvedValue(undefined);
    storage.exists.mockResolvedValue(true);
  });

  describe('upload', () => {
    it('rejects a file over the limit with 413 FILE_TOO_LARGE', async () => {
      const error = await expectHttpError(
        service.upload(
          PATIENT,
          APPOINTMENT_ID,
          buildFile({ size: MAX_BYTES + 1 }),
        ),
      );

      expect(error.getStatus()).toBe(413);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'FILE_TOO_LARGE',
      });
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('rejects a disallowed type with 415 UNSUPPORTED_MEDIA_TYPE', async () => {
      const error = await expectHttpError(
        service.upload(
          PATIENT,
          APPOINTMENT_ID,
          buildFile({ mimetype: 'application/zip' }),
        ),
      );

      expect(error.getStatus()).toBe(415);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'UNSUPPORTED_MEDIA_TYPE',
      });
      expect(storage.save).not.toHaveBeenCalled();
      expect(prisma.attachment.create).not.toHaveBeenCalled();
    });

    it('only allows participants to upload', async () => {
      access.assertAppointmentAccess.mockRejectedValue(forbidden());

      const error = await expectHttpError(
        service.upload(PATIENT, APPOINTMENT_ID, buildFile()),
      );

      expect(error.getStatus()).toBe(403);
      expect(error.getResponse()).toMatchObject({ errorCode: 'FORBIDDEN' });
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('rejects a consultation from another appointment', async () => {
      prisma.consultation.findFirst.mockResolvedValue(null);

      const error = await expectHttpError(
        service.upload(
          PATIENT,
          APPOINTMENT_ID,
          buildFile(),
          'b0000000-0000-4000-8000-000000000002',
        ),
      );

      expect(error.getStatus()).toBe(400);
      expect(error.getResponse()).toMatchObject({
        errorCode: 'VALIDATION_FAILED',
      });
      expect(storage.save).not.toHaveBeenCalled();
    });

    it('sanitizes the storage key to a uuid plus a safe extension', async () => {
      const originalName = '../../etc/passwd.txt';
      prisma.attachment.create.mockResolvedValue(
        buildAttachment({
          id: 'attachment-9',
          fileName: originalName,
          contentType: 'text/plain',
          kind: 'document',
          storageKey: 'generated.txt',
        }),
      );

      const dto = await service.upload(
        PATIENT,
        APPOINTMENT_ID,
        buildFile({
          originalname: originalName,
          mimetype: 'text/plain',
        }),
      );

      expect(storage.save).toHaveBeenCalledTimes(1);
      const [savedBuffer, storageKey] = storage.save.mock.calls[0];
      expect(savedBuffer).toEqual(expect.any(Buffer));
      expect(storageKey).not.toBe(originalName);
      expect(storageKey).not.toContain('..');
      expect(storageKey).not.toContain('/');
      expect(storageKey).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.txt$/,
      );
      expect(prisma.attachment.create.mock.calls[0][0].data.storageKey).toBe(
        storageKey,
      );
      expect(dto.fileName).toBe(originalName);
      expect(dto.downloadUrl).toBe('/api/attachments/attachment-9');
    });
  });

  describe('list', () => {
    it('only allows participants to list', async () => {
      access.assertAppointmentAccess.mockRejectedValue(forbidden());

      const error = await expectHttpError(
        service.list(PATIENT, APPOINTMENT_ID),
      );

      expect(error.getStatus()).toBe(403);
      expect(prisma.attachment.findMany).not.toHaveBeenCalled();
    });

    it('returns the attachments for a participant', async () => {
      prisma.attachment.findMany.mockResolvedValue([buildAttachment()]);

      const attachments = await service.list(DOCTOR, APPOINTMENT_ID);

      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toMatchObject({
        id: 'attachment-1',
        appointmentId: APPOINTMENT_ID,
        downloadUrl: '/api/attachments/attachment-1',
      });
    });
  });

  describe('loadForDownload', () => {
    it('returns 404 when the row does not exist', async () => {
      prisma.attachment.findUnique.mockResolvedValue(null);

      const error = await expectHttpError(
        service.loadForDownload(PATIENT, 'attachment-1'),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
      expect(access.assertAppointmentAccess).not.toHaveBeenCalled();
    });

    it('only allows participants to download', async () => {
      prisma.attachment.findUnique.mockResolvedValue(buildAttachment());
      access.assertAppointmentAccess.mockRejectedValue(forbidden());

      const error = await expectHttpError(
        service.loadForDownload(PATIENT, 'attachment-1'),
      );

      expect(error.getStatus()).toBe(403);
      expect(storage.exists).not.toHaveBeenCalled();
    });

    it('returns 404 when the on-disk file is missing', async () => {
      prisma.attachment.findUnique.mockResolvedValue(buildAttachment());
      storage.exists.mockResolvedValue(false);

      const error = await expectHttpError(
        service.loadForDownload(PATIENT, 'attachment-1'),
      );

      expect(error.getStatus()).toBe(404);
      expect(error.getResponse()).toMatchObject({ errorCode: 'NOT_FOUND' });
      expect(storage.createReadStream).not.toHaveBeenCalled();
    });

    it('returns metadata and a readable stream for a participant', async () => {
      const stream = Readable.from('conteudo') as unknown as ReadStream;
      prisma.attachment.findUnique.mockResolvedValue(buildAttachment());
      storage.createReadStream.mockReturnValue(stream);

      const download = await service.loadForDownload(PATIENT, 'attachment-1');

      expect(download.attachment.id).toBe('attachment-1');
      expect(download.stream).toBe(stream);
      expect(storage.exists).toHaveBeenCalledWith(
        '11111111-1111-4111-8111-111111111111.pdf',
      );
    });
  });
});
