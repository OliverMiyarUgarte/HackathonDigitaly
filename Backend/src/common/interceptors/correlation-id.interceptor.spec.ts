import type { CallHandler, ExecutionContext } from '@nestjs/common';
import { lastValueFrom, Observable, of } from 'rxjs';
import { RequestContextService } from '../context/request-context.service';
import { CorrelationIdInterceptor } from './correlation-id.interceptor';

interface MockRequest {
  headers: Record<string, string | string[] | undefined>;
  correlationId?: string;
  method: string;
  path: string;
  url: string;
  user?: { sub: string; role: 'doctor' | 'patient' };
}

interface MockResponse {
  setHeader: jest.Mock<void, [string, string]>;
}

function createContext(
  request: MockRequest,
  response: MockResponse,
): ExecutionContext {
  return {
    getType: () => 'http',
    switchToHttp: () => ({
      getRequest: () => request,
      getResponse: () => response,
      getNext: () => undefined,
    }),
  } as unknown as ExecutionContext;
}

function createNext(): CallHandler<unknown> {
  return { handle: () => of(undefined) };
}

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('CorrelationIdInterceptor', () => {
  let requestContext: RequestContextService;
  let interceptor: CorrelationIdInterceptor;

  beforeEach(() => {
    requestContext = new RequestContextService();
    interceptor = new CorrelationIdInterceptor(requestContext);
  });

  it('passes through a provided x-correlation-id', async () => {
    const request: MockRequest = {
      headers: { 'x-correlation-id': 'provided-123' },
      method: 'GET',
      path: '/api/health',
      url: '/api/health',
    };
    const response: MockResponse = {
      setHeader: jest.fn<void, [string, string]>(),
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request, response), createNext()),
    );

    expect(request.correlationId).toBe('provided-123');
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      'provided-123',
    );
  });

  it('generates a correlation id when the header is missing', async () => {
    const request: MockRequest = {
      headers: {},
      method: 'GET',
      path: '/api/health',
      url: '/api/health',
    };
    const response: MockResponse = {
      setHeader: jest.fn<void, [string, string]>(),
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request, response), createNext()),
    );

    expect(request.correlationId).toMatch(UUID_PATTERN);
    expect(response.setHeader).toHaveBeenCalledWith(
      'x-correlation-id',
      request.correlationId,
    );
  });

  it('generates a correlation id when the header is blank', async () => {
    const request: MockRequest = {
      headers: { 'x-correlation-id': '   ' },
      method: 'GET',
      path: '/api/health',
      url: '/api/health',
    };
    const response: MockResponse = {
      setHeader: jest.fn<void, [string, string]>(),
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request, response), createNext()),
    );

    expect(request.correlationId).toMatch(UUID_PATTERN);
  });

  it('exposes the correlation id and user id to the request handler', async () => {
    const request: MockRequest = {
      headers: { 'x-correlation-id': 'ctx-1' },
      method: 'GET',
      path: '/api/records/1',
      url: '/api/records/1',
      user: { sub: 'user-1', role: 'patient' },
    };
    const response: MockResponse = {
      setHeader: jest.fn<void, [string, string]>(),
    };
    const next: CallHandler<unknown> = {
      handle: () =>
        new Observable((subscriber) => {
          expect(requestContext.getCorrelationId()).toBe('ctx-1');
          expect(requestContext.getUserId()).toBe('user-1');
          subscriber.next(undefined);
          subscriber.complete();
        }),
    };

    await lastValueFrom(
      interceptor.intercept(createContext(request, response), next),
    );
  });
});
