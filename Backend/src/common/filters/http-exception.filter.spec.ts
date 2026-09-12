import {
  ArgumentsHost,
  BadRequestException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import type { ErrorResponseDto } from '@telemed/service-contracts';
import type { RequestWithContext } from '../types/request-with-context';
import { HttpExceptionFilter } from './http-exception.filter';

interface MockResponse {
  status: jest.Mock<MockResponse, [number]>;
  json: jest.Mock<void, [ErrorResponseDto]>;
}

function createResponse(): MockResponse {
  const response: MockResponse = {
    status: jest.fn<MockResponse, [number]>(),
    json: jest.fn<void, [ErrorResponseDto]>(),
  };
  response.status.mockReturnValue(response);
  return response;
}

function createHost(
  request: Partial<RequestWithContext>,
  response: MockResponse,
): ArgumentsHost {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as unknown as ArgumentsHost;
}

function jsonBody(response: MockResponse): ErrorResponseDto {
  return response.json.mock.calls[0][0];
}

describe('HttpExceptionFilter', () => {
  let filter: HttpExceptionFilter;
  let errorSpy: jest.SpyInstance;

  beforeEach(() => {
    filter = new HttpExceptionFilter();
    errorSpy = jest
      .spyOn(Logger.prototype, 'error')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('maps a class-validator 400 error to the contract shape', () => {
    const response = createResponse();
    const host = createHost(
      {
        url: '/api/appointments?email=ana@example.com',
        path: '/api/appointments',
        correlationId: 'corr-1',
      },
      response,
    );
    const exception = new BadRequestException({
      statusCode: 400,
      error: 'Bad Request',
      message: ['email must be an email', 'slot must be a valid date'],
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(400);
    const body = jsonBody(response);
    expect(body).toMatchObject({
      statusCode: 400,
      error: 'VALIDATION_FAILED',
      message: 'Validation failed',
      details: ['email must be an email', 'slot must be a valid date'],
      path: '/api/appointments',
      correlationId: 'corr-1',
    });
    expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('uses an explicit ErrorCode from the exception response', () => {
    const response = createResponse();
    const host = createHost(
      { path: '/api/auth/register', correlationId: 'corr-2' },
      response,
    );
    const exception = new ConflictException({
      statusCode: 409,
      errorCode: 'EMAIL_TAKEN',
      message: 'Email already registered',
    });

    filter.catch(exception, host);

    expect(response.status).toHaveBeenCalledWith(409);
    expect(jsonBody(response)).toMatchObject({
      statusCode: 409,
      error: 'EMAIL_TAKEN',
      message: 'Email already registered',
      details: null,
      path: '/api/auth/register',
      correlationId: 'corr-2',
    });
  });

  it('maps an unknown error to a generic 500 without leaking details', () => {
    const response = createResponse();
    const host = createHost(
      { path: '/api/records', correlationId: 'corr-3' },
      response,
    );

    filter.catch(new Error('token=super-secret patient ana@example.com'), host);

    expect(response.status).toHaveBeenCalledWith(500);
    const body = jsonBody(response);
    expect(body).toEqual({
      statusCode: 500,
      error: 'INTERNAL_ERROR',
      message: 'Internal server error',
      details: null,
      timestamp: body.timestamp,
      path: '/api/records',
      correlationId: 'corr-3',
    });
    expect(JSON.stringify(body)).not.toContain('super-secret');
    expect(JSON.stringify(body)).not.toContain('ana@example.com');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('generates a correlation id when none is present on the request', () => {
    const response = createResponse();
    const host = createHost({ path: '/api/health' }, response);

    filter.catch(new Error('unexpected'), host);

    expect(jsonBody(response).correlationId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
  });
});
