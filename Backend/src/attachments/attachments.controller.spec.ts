import { HttpStatus } from '@nestjs/common';
import type { AttachmentDto } from '@telemed/service-contracts';
import type { Response } from 'express';
import type { AuthenticatedUser } from '../common/types/authenticated-user';
import { AttachmentsController } from './attachments.controller';
import type { AttachmentsService } from './attachments.service';

const USER: AuthenticatedUser = { sub: 'user-1', role: 'patient' };

function buildAttachment(): AttachmentDto {
  return {
    id: 'attachment-1',
    appointmentId: 'appointment-1',
    consultationId: null,
    uploaderId: USER.sub,
    fileName: 'exame.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1024,
    kind: 'document',
    downloadUrl: '/api/attachments/attachment-1',
    createdAt: '2026-01-01T00:00:00.000Z',
  };
}

interface ResponseMock {
  setHeader: jest.Mock;
  status: jest.Mock;
  json: jest.Mock;
  destroy: jest.Mock;
  headersSent: boolean;
}

function createResponse(): ResponseMock {
  const response: ResponseMock = {
    setHeader: jest.fn(),
    status: jest.fn(),
    json: jest.fn(),
    destroy: jest.fn(),
    headersSent: false,
  };
  response.status.mockReturnValue(response);
  return response;
}

interface StreamMock {
  on: jest.Mock;
  pipe: jest.Mock;
}

function createStreamMock(): {
  stream: StreamMock;
  emitError: (error: Error) => void;
} {
  const handlers = new Map<string, (error: Error) => void>();
  const stream: StreamMock = {
    on: jest.fn((event: string, handler: (error: Error) => void) => {
      handlers.set(event, handler);
    }),
    pipe: jest.fn(),
  };
  return {
    stream,
    emitError: (error: Error) => handlers.get('error')?.(error),
  };
}

describe('AttachmentsController', () => {
  let controller: AttachmentsController;
  let service: { loadForDownload: jest.Mock };

  beforeEach(() => {
    service = { loadForDownload: jest.fn() };
    controller = new AttachmentsController(
      service as unknown as AttachmentsService,
    );
  });

  it('maps a stream error before headers to a generic 500 without leaking paths', async () => {
    const { stream, emitError } = createStreamMock();
    service.loadForDownload.mockResolvedValue({
      attachment: buildAttachment(),
      stream,
    });
    const response = createResponse();

    await controller.download(
      USER,
      'attachment-1',
      response as unknown as Response,
    );
    emitError(new Error('/srv/private/uploads/secret.pdf'));

    expect(response.status).toHaveBeenCalledWith(
      HttpStatus.INTERNAL_SERVER_ERROR,
    );
    expect(response.json).toHaveBeenCalledWith(
      expect.objectContaining({
        error: 'INTERNAL_ERROR',
        message: 'Internal server error',
      }),
    );
    expect(JSON.stringify(response.json.mock.calls)).not.toContain('secret');
  });

  it('destroys the response when the stream fails after headers were sent', async () => {
    const { stream, emitError } = createStreamMock();
    service.loadForDownload.mockResolvedValue({
      attachment: buildAttachment(),
      stream,
    });
    const response = createResponse();
    response.headersSent = true;

    await controller.download(
      USER,
      'attachment-1',
      response as unknown as Response,
    );
    emitError(new Error('mid-stream failure'));

    expect(response.destroy).toHaveBeenCalled();
    expect(response.status).not.toHaveBeenCalled();
  });
});
