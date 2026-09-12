import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { ErrorCode, ErrorResponseDto } from '@telemed/service-contracts';
import type { Response } from 'express';
import { randomUUID } from 'node:crypto';
import type { RequestWithContext } from '../types/request-with-context';

const DEFAULT_MESSAGES = {
  VALIDATION_FAILED: 'Validation failed',
  UNAUTHENTICATED: 'Authentication required',
  FORBIDDEN: 'Access denied',
  NOT_FOUND: 'Resource not found',
  CONFLICT: 'Resource conflict',
  EMAIL_TAKEN: 'Email already registered',
  INVALID_CREDENTIALS: 'Invalid credentials',
  INVALID_REFRESH_TOKEN: 'Invalid refresh token',
  INVALID_OR_EXPIRED_CODE: 'Invalid or expired code',
  TOO_MANY_ATTEMPTS: 'Too many attempts',
  RATE_LIMITED: 'Too many requests',
  SLOT_TAKEN: 'Slot already taken',
  APPOINTMENT_NOT_CONFIRMED: 'Appointment not confirmed',
  APPOINTMENT_TERMINAL: 'Appointment is in a terminal state',
  CONSULTATION_EXISTS: 'Consultation already exists',
  CONSULTATION_NOT_ACTIVE: 'Consultation is not active',
  RECORD_EXISTS: 'Record already exists',
  FILE_TOO_LARGE: 'File too large',
  UNSUPPORTED_MEDIA_TYPE: 'Unsupported media type',
  AI_UNAVAILABLE: 'AI service unavailable',
  INTERNAL_ERROR: 'Internal server error',
} satisfies Record<ErrorCode, string>;

const STATUS_ERROR_CODES: Partial<Record<number, ErrorCode>> = {
  [HttpStatus.BAD_REQUEST]: 'VALIDATION_FAILED',
  [HttpStatus.UNAUTHORIZED]: 'UNAUTHENTICATED',
  [HttpStatus.FORBIDDEN]: 'FORBIDDEN',
  [HttpStatus.NOT_FOUND]: 'NOT_FOUND',
  [HttpStatus.CONFLICT]: 'CONFLICT',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'FILE_TOO_LARGE',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'UNSUPPORTED_MEDIA_TYPE',
  [HttpStatus.TOO_MANY_REQUESTS]: 'RATE_LIMITED',
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return (
    typeof value === 'string' &&
    Object.prototype.hasOwnProperty.call(DEFAULT_MESSAGES, value)
  );
}

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const request = context.getRequest<RequestWithContext>();
    const response = context.getResponse<Response>();
    const correlationId = request.correlationId ?? randomUUID();
    const path = this.resolvePath(request);
    const timestamp = new Date().toISOString();

    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const error = this.resolveErrorCode(exceptionResponse, status);
      const body: ErrorResponseDto = {
        statusCode: status,
        error,
        message: this.resolveMessage(exceptionResponse, error),
        details: this.resolveDetails(exceptionResponse),
        timestamp,
        path,
        correlationId,
      };
      response.status(status).json(body);
      return;
    }

    this.logUnknownError(exception);
    const body: ErrorResponseDto = {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_ERROR',
      message: DEFAULT_MESSAGES.INTERNAL_ERROR,
      details: null,
      timestamp,
      path,
      correlationId,
    };
    response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(body);
  }

  private resolveErrorCode(
    exceptionResponse: string | object,
    status: number,
  ): ErrorCode {
    if (isRecord(exceptionResponse)) {
      if (isErrorCode(exceptionResponse.errorCode)) {
        return exceptionResponse.errorCode;
      }
      if (isErrorCode(exceptionResponse.error)) {
        return exceptionResponse.error;
      }
    }
    return STATUS_ERROR_CODES[status] ?? 'INTERNAL_ERROR';
  }

  private resolveMessage(
    exceptionResponse: string | object,
    error: ErrorCode,
  ): string {
    if (typeof exceptionResponse === 'string' && exceptionResponse.length > 0) {
      return exceptionResponse;
    }
    if (isRecord(exceptionResponse)) {
      const message = exceptionResponse.message;
      if (typeof message === 'string' && message.length > 0) {
        return message;
      }
    }
    return DEFAULT_MESSAGES[error];
  }

  private resolveDetails(exceptionResponse: string | object): string[] | null {
    if (!isRecord(exceptionResponse)) {
      return null;
    }
    const rawMessage = exceptionResponse.message;
    if (!Array.isArray(rawMessage)) {
      return null;
    }
    const details: string[] = [];
    for (const item of rawMessage as unknown[]) {
      if (typeof item === 'string') {
        details.push(item);
      }
    }
    return details.length > 0 ? details : null;
  }

  private resolvePath(request: RequestWithContext): string {
    if (request.path) {
      return request.path;
    }
    return request.url.split('?')[0];
  }

  private logUnknownError(exception: unknown): void {
    if (exception instanceof Error) {
      this.logger.error(exception.message, exception.stack);
      return;
    }
    this.logger.error('Unknown exception');
  }
}
