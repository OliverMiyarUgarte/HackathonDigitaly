import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';
import type { RequestWithContext } from '../types/request-with-context';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger(LoggingInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const method = request.method;
    const path = this.resolvePath(request);
    const startedAt = Date.now();
    const userId = request.user?.sub;

    return next.handle().pipe(
      tap({
        next: () =>
          this.logRequest(method, path, response.statusCode, startedAt, userId),
        error: (error: unknown) =>
          this.logRequest(
            method,
            path,
            this.resolveStatus(error),
            startedAt,
            userId,
          ),
      }),
    );
  }

  private logRequest(
    method: string,
    path: string,
    status: number,
    startedAt: number,
    userId?: string,
  ): void {
    const durationMs = Date.now() - startedAt;
    const actor = userId ?? 'anonymous';
    this.logger.log(
      `${method} ${path} ${status} ${durationMs}ms userId=${actor}`,
    );
  }

  private resolveStatus(error: unknown): number {
    return error instanceof HttpException
      ? error.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;
  }

  private resolvePath(request: RequestWithContext): string {
    if (request.path) {
      return request.path;
    }
    return request.url.split('?')[0];
  }
}
