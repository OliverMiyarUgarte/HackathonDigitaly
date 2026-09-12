import { Logger } from '@nestjs/common';
import { RequestContextService } from '../context/request-context.service';
import type { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from './audit.service';

interface AuditLogCreateArgs {
  data: {
    actorId: string | null;
    action: string;
    resourceType: string;
    resourceId: string;
    metadata?: Record<string, unknown>;
  };
}

interface PrismaMock {
  auditLog: {
    create: jest.Mock<Promise<{ id: string }>, [AuditLogCreateArgs]>;
  };
}

interface RequestContextMock {
  getCorrelationId: jest.Mock<string | undefined, []>;
}

function createPrismaMock(): PrismaMock {
  return {
    auditLog: {
      create: jest.fn<Promise<{ id: string }>, [AuditLogCreateArgs]>(() =>
        Promise.resolve({ id: 'audit-1' }),
      ),
    },
  };
}

function createRequestContextMock(): RequestContextMock {
  return { getCorrelationId: jest.fn(() => 'corr-1') };
}

describe('AuditService', () => {
  let service: AuditService;
  let prisma: PrismaMock;
  let requestContext: RequestContextMock;

  beforeEach(() => {
    prisma = createPrismaMock();
    requestContext = createRequestContextMock();
    service = new AuditService(
      prisma as unknown as PrismaService,
      requestContext as unknown as RequestContextService,
    );
  });

  it('writes the expected row with outcome and correlation id', async () => {
    await service.record({
      actorId: 'user-1',
      action: 'medical_record.read',
      resourceType: 'medical_record',
      resourceId: 'record-1',
      outcome: 'success',
      metadata: { source: 'api' },
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: 'user-1',
        action: 'medical_record.read',
        resourceType: 'medical_record',
        resourceId: 'record-1',
        metadata: {
          source: 'api',
          outcome: 'success',
          correlationId: 'corr-1',
        },
      },
    });
  });

  it('defaults the actor to null and omits metadata when there is nothing safe to store', async () => {
    requestContext.getCorrelationId.mockReturnValue(undefined);

    await service.record({
      action: 'auth.login',
      resourceType: 'user',
      resourceId: 'user-1',
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        actorId: null,
        action: 'auth.login',
        resourceType: 'user',
        resourceId: 'user-1',
      },
    });
  });

  it('never persists notes, answers, diagnoses, tokens, codes or e-mails', async () => {
    await service.record({
      actorId: 'user-1',
      action: 'medical_record.read',
      resourceType: 'medical_record',
      resourceId: 'record-1',
      outcome: 'success',
      metadata: {
        attempts: 2,
        note: 'Paciente relata palpitacoes em repouso',
        diagnosis: 'Hipertensao arterial',
        answer: 'Palpitacoes frequentes',
        token: 'raw-access-token',
        code: '482913',
        email: 'paciente@digitaly.health',
        transcript: 'trecho da consulta',
        correlationId: 'spoofed-by-caller',
      },
    });

    const call = prisma.auditLog.create.mock.calls[0][0];
    expect(call.data.metadata).toEqual({
      attempts: 2,
      outcome: 'success',
      correlationId: 'corr-1',
    });

    const serialized = JSON.stringify(call);
    for (const secret of [
      'Paciente relata palpitacoes em repouso',
      'Hipertensao arterial',
      'Palpitacoes frequentes',
      'raw-access-token',
      '482913',
      'paciente@digitaly.health',
      'trecho da consulta',
    ]) {
      expect(serialized).not.toContain(secret);
    }
  });

  it('swallows database failures and logs only a generic message', async () => {
    const errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
    prisma.auditLog.create.mockRejectedValue(new Error('db is down'));

    await expect(
      service.record({
        actorId: 'user-1',
        action: 'attachment.download',
        resourceType: 'attachment',
        resourceId: 'attachment-1',
        outcome: 'success',
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).toHaveBeenCalledWith('Audit log write failed');
    expect(JSON.stringify(errorSpy.mock.calls)).not.toContain('db is down');

    errorSpy.mockRestore();
  });
});
