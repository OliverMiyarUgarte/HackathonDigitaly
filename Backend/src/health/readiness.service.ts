import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type {
  DependencyStatus,
  ReadyResponseDto,
} from '@telemed/service-contracts';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_AI_SERVICE_URL = 'http://localhost:8000';
const DATABASE_TIMEOUT_MS = 2_000;
const AI_TIMEOUT_MS = 1_500;

@Injectable()
export class ReadinessService {
  private readonly logger = new Logger(ReadinessService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  async check(): Promise<ReadyResponseDto> {
    const [database, ai] = await Promise.all([
      this.checkDatabase(),
      this.checkAi(),
    ]);

    return {
      status: database === 'up' && ai === 'up' ? 'ok' : 'degraded',
      checks: { database, ai },
      timestamp: new Date().toISOString(),
    };
  }

  private async checkDatabase(): Promise<DependencyStatus> {
    try {
      await this.withTimeout(
        this.prisma.$queryRaw`SELECT 1`,
        DATABASE_TIMEOUT_MS,
      );
      return 'up';
    } catch {
      this.logger.warn('Database readiness check failed');
      return 'down';
    }
  }

  private async checkAi(): Promise<DependencyStatus> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), AI_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.aiServiceUrl}/health`, {
        method: 'GET',
        signal: controller.signal,
      });
      return response.ok ? 'up' : 'down';
    } catch {
      return 'down';
    } finally {
      clearTimeout(timer);
    }
  }

  private get aiServiceUrl(): string {
    const base =
      this.configService.get<string>('AI_SERVICE_URL') ??
      DEFAULT_AI_SERVICE_URL;
    return base.replace(/\/+$/, '');
  }

  private withTimeout<T>(
    operation: PromiseLike<T>,
    timeoutMs: number,
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(
        () => reject(new Error('Readiness check timed out')),
        timeoutMs,
      );
      operation.then(
        (value) => {
          clearTimeout(timer);
          resolve(value);
        },
        (error: unknown) => {
          clearTimeout(timer);
          reject(
            error instanceof Error
              ? error
              : new Error('Readiness check failed'),
          );
        },
      );
    });
  }
}
