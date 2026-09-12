import {
  BadRequestException,
  Injectable,
  NotFoundException,
  PayloadTooLargeException,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AttachmentDto, AttachmentKind } from '@telemed/service-contracts';
import { randomUUID } from 'node:crypto';
import type { ReadStream } from 'node:fs';
import { AppointmentAccessService } from '../appointments/appointment-access.service';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import type { Attachment } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from './storage/storage.service';

const DEFAULT_UPLOAD_MAX_BYTES = 10_485_760;

interface AllowedFileType {
  kind: AttachmentKind;
  extension: string;
}

const ALLOWED_FILE_TYPES: Readonly<Record<string, AllowedFileType>> = {
  'application/pdf': { kind: 'document', extension: '.pdf' },
  'image/png': { kind: 'image', extension: '.png' },
  'image/jpeg': { kind: 'image', extension: '.jpg' },
  'image/webp': { kind: 'image', extension: '.webp' },
  'text/plain': { kind: 'document', extension: '.txt' },
};

export interface AttachmentDownload {
  attachment: AttachmentDto;
  stream: ReadStream;
}

@Injectable()
export class AttachmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AppointmentAccessService,
    private readonly storage: StorageService,
    private readonly configService: ConfigService,
  ) {}

  async upload(
    user: AuthenticatedUser,
    appointmentId: string,
    file: Express.Multer.File,
    consultationId?: string,
  ): Promise<AttachmentDto> {
    await this.accessService.assertAppointmentAccess(user, appointmentId);

    if (consultationId) {
      const consultation = await this.prisma.consultation.findFirst({
        where: { id: consultationId, appointmentId },
        select: { id: true },
      });
      if (!consultation) {
        throw new BadRequestException({
          errorCode: 'VALIDATION_FAILED',
          message: 'Consultation does not belong to this appointment',
        });
      }
    }

    if (file.size > this.maxBytes()) {
      throw new PayloadTooLargeException({
        errorCode: 'FILE_TOO_LARGE',
        message: 'File too large',
      });
    }

    const allowedType = ALLOWED_FILE_TYPES[file.mimetype];
    if (!allowedType) {
      throw new UnsupportedMediaTypeException({
        errorCode: 'UNSUPPORTED_MEDIA_TYPE',
        message: 'Unsupported media type',
      });
    }

    const storageKey = `${randomUUID()}${allowedType.extension}`;
    await this.storage.save(file.buffer, storageKey);

    try {
      const attachment = await this.prisma.attachment.create({
        data: {
          appointmentId,
          consultationId: consultationId ?? null,
          uploaderId: user.sub,
          fileName: file.originalname,
          contentType: file.mimetype,
          sizeBytes: file.size,
          kind: allowedType.kind,
          storageKey,
        },
      });
      return toAttachmentDto(attachment);
    } catch (error) {
      await this.storage.remove(storageKey);
      throw error;
    }
  }

  async list(
    user: AuthenticatedUser,
    appointmentId: string,
  ): Promise<AttachmentDto[]> {
    await this.accessService.assertAppointmentAccess(user, appointmentId);
    const attachments = await this.prisma.attachment.findMany({
      where: { appointmentId },
      orderBy: { createdAt: 'desc' },
    });
    return attachments.map(toAttachmentDto);
  }

  async loadForDownload(
    user: AuthenticatedUser,
    attachmentId: string,
  ): Promise<AttachmentDownload> {
    const attachment = await this.prisma.attachment.findUnique({
      where: { id: attachmentId },
    });
    if (!attachment) {
      throw this.notFound('Attachment not found');
    }

    await this.accessService.assertAppointmentAccess(
      user,
      attachment.appointmentId,
    );

    if (!(await this.storage.exists(attachment.storageKey))) {
      throw this.notFound('Attachment file not found');
    }

    return {
      attachment: toAttachmentDto(attachment),
      stream: this.storage.createReadStream(attachment.storageKey),
    };
  }

  private maxBytes(): number {
    return this.configService.get<number>(
      'UPLOAD_MAX_BYTES',
      DEFAULT_UPLOAD_MAX_BYTES,
    );
  }

  private notFound(message: string): NotFoundException {
    return new NotFoundException({ errorCode: 'NOT_FOUND', message });
  }
}

function toAttachmentDto(attachment: Attachment): AttachmentDto {
  return {
    id: attachment.id,
    appointmentId: attachment.appointmentId,
    consultationId: attachment.consultationId,
    uploaderId: attachment.uploaderId,
    fileName: attachment.fileName,
    contentType: attachment.contentType,
    sizeBytes: attachment.sizeBytes,
    kind: attachment.kind,
    downloadUrl: `/api/attachments/${attachment.id}`,
    createdAt: attachment.createdAt.toISOString(),
  };
}
