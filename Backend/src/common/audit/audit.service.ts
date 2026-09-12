import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { RequestContextService } from '../context/request-context.service';

export type AuditOutcome = 'success' | 'denied';

export interface AuditEntry {
  actorId?: string | null;
  action: string;
  resourceType: string;
  resourceId: string;
  outcome?: AuditOutcome;
  metadata?: Record<string, string | number | boolean>;
}

export const UNKNOWN_RESOURCE_ID = '00000000-0000-0000-0000-000000000000';

const SENSITIVE_METADATA_KEY_PATTERN =
  /pass|secret|token|code|otp|email|note|diagnos|answer|transcript|audio|phi/i;
const EMAIL_VALUE_PATTERN = /[^\s@]+@[^\s@]+\.[^\s@]+/;
const MAX_METADATA_STRING_LENGTH = 128;
const AUDIT_WRITE_FAILED = 'Audit log write failed';

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  async record(entry: AuditEntry): Promise<void> {
    try {
      const metadata = this.buildMetadata(entry);
      await this.prisma.auditLog.create({
        data: {
          actorId: entry.actorId ?? null,
          action: entry.action,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          ...(metadata ? { metadata } : {}),
        },
      });
    } catch {
      this.logger.error(AUDIT_WRITE_FAILED);
    }
  }

  private buildMetadata(
    entry: AuditEntry,
  ): Record<string, string | number | boolean> | null {
    const metadata = this.sanitizeMetadata(entry.metadata);
    if (entry.outcome) {
      metadata.outcome = entry.outcome;
    }
    const correlationId = this.requestContext.getCorrelationId();
    if (correlationId) {
      metadata.correlationId = correlationId;
    }
    return Object.keys(metadata).length > 0 ? metadata : null;
  }

  private sanitizeMetadata(
    metadata: Record<string, string | number | boolean> | undefined,
  ): Record<string, string | number | boolean> {
    const sanitized: Record<string, string | number | boolean> = {};
    if (!metadata) {
      return sanitized;
    }
    for (const [key, value] of Object.entries(metadata)) {
      if (SENSITIVE_METADATA_KEY_PATTERN.test(key)) {
        continue;
      }
      if (typeof value === 'string') {
        if (
          value.length > MAX_METADATA_STRING_LENGTH ||
          EMAIL_VALUE_PATTERN.test(value)
        ) {
          continue;
        }
      }
      sanitized[key] = value;
    }
    return sanitized;
  }
}
