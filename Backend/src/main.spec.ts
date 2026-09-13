import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';

interface AppDouble {
  enableShutdownHooks: jest.Mock;
  get: jest.Mock;
  set: jest.Mock;
  setGlobalPrefix: jest.Mock;
  useGlobalPipes: jest.Mock;
  enableCors: jest.Mock;
  listen: jest.Mock<Promise<void>, [number]>;
}

function createAppDouble(): { app: AppDouble; config: ConfigService } {
  const config = new ConfigService({
    WEB_ORIGIN: 'http://localhost:3000',
    SWAGGER_ENABLED: false,
    PORT: 3001,
  });
  const app: AppDouble = {
    enableShutdownHooks: jest.fn(),
    get: jest.fn(() => config),
    set: jest.fn(),
    setGlobalPrefix: jest.fn(),
    useGlobalPipes: jest.fn(),
    enableCors: jest.fn(),
    listen: jest.fn<Promise<void>, [number]>(() => Promise.resolve()),
  };
  return { app, config };
}

const flushPromises = (): Promise<void> =>
  new Promise((resolve) => setImmediate(resolve));

describe('bootstrap', () => {
  it('trusts the first proxy hop and binds the configured port', async () => {
    const { app } = createAppDouble();
    const createSpy = jest
      .spyOn(NestFactory, 'create')
      .mockResolvedValue(app as unknown as NestExpressApplication);

    try {
      await import('./main.js');
      await flushPromises();
      await flushPromises();

      expect(app.set).toHaveBeenCalledWith('trust proxy', 1);
      expect(app.listen).toHaveBeenCalledWith(3001);
    } finally {
      createSpy.mockRestore();
    }
  });
});
