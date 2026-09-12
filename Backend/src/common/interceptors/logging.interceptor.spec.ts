import {
  Logger,
  type CallHandler,
  type ExecutionContext,
} from '@nestjs/common';
import { lastValueFrom, of } from 'rxjs';
import { LoggingInterceptor } from './logging.interceptor';

interface MockRequest {
  method: string;
  path: string;
  url: string;
  route?: { path: string };
  user?: { sub: string };
}

interface MockResponse {
  statusCode: number;
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

describe('LoggingInterceptor', () => {
  const interceptor = new LoggingInterceptor();
  let logSpy: jest.SpyInstance;

  beforeEach(() => {
    logSpy = jest
      .spyOn(Logger.prototype, 'log')
      .mockImplementation(() => undefined);
  });

  afterEach(() => {
    logSpy.mockRestore();
  });

  it('logs the matched route template instead of raw identifiers', async () => {
    const request: MockRequest = {
      method: 'GET',
      path: '/api/patients/abc-123/overview',
      url: '/api/patients/abc-123/overview',
      route: { path: '/api/patients/:patientId/overview' },
    };

    await lastValueFrom(
      interceptor.intercept(
        createContext(request, { statusCode: 200 }),
        createNext(),
      ),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('/api/patients/:patientId/overview'),
    );
    expect(logSpy).not.toHaveBeenCalledWith(expect.stringContaining('abc-123'));
  });

  it('falls back to the path when no route template matched', async () => {
    const request: MockRequest = {
      method: 'GET',
      path: '/api/unknown',
      url: '/api/unknown?page=1',
    };

    await lastValueFrom(
      interceptor.intercept(
        createContext(request, { statusCode: 404 }),
        createNext(),
      ),
    );

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining('GET /api/unknown 404'),
    );
  });
});
