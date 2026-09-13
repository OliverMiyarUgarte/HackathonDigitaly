import type {
  CallHandler,
  ExecutionContext,
  NestInterceptor,
} from '@nestjs/common';
import { Injectable } from '@nestjs/common';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import { Observable } from 'rxjs';
import type { Subscription } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';
import { isValidCorrelationId } from '../context/correlation-id';
import type { RequestWithContext } from '../types/request-with-context';

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  constructor(private readonly requestContext: RequestContextService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest<RequestWithContext>();
    const response = http.getResponse<Response>();
    const header = request.headers['x-correlation-id'];
    const provided = Array.isArray(header) ? header[0] : header;
    const correlationId = isValidCorrelationId(provided)
      ? provided
      : randomUUID();

    request.correlationId = correlationId;
    response.setHeader('x-correlation-id', correlationId);

    const userId = request.user?.sub;
    return new Observable((subscriber) => {
      let subscription: Subscription | undefined;
      this.requestContext.run(
        userId ? { correlationId, userId } : { correlationId },
        () => {
          subscription = next.handle().subscribe(subscriber);
        },
      );
      return () => subscription?.unsubscribe();
    });
  }
}
