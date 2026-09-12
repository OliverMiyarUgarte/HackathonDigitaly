import { BadRequestException } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { LocalStorageService } from './local-storage.service';

interface ConfigMock {
  get: jest.Mock<string, [string, unknown?]>;
}

describe('LocalStorageService', () => {
  let directory: string;
  let service: LocalStorageService;

  beforeEach(async () => {
    directory = await mkdtemp(join(tmpdir(), 'digitaly-uploads-'));
    const config: ConfigMock = {
      get: jest.fn<string, [string, unknown?]>(() => directory),
    };
    service = new LocalStorageService(config as unknown as ConfigService);
  });

  afterEach(async () => {
    await rm(directory, { recursive: true, force: true });
  });

  it('saves, reads and removes a file', async () => {
    await service.save(Buffer.from('hello'), 'file.txt');

    expect(await service.exists('file.txt')).toBe(true);
    expect(await readFile(join(directory, 'file.txt'), 'utf8')).toBe('hello');

    await service.remove('file.txt');
    expect(await service.exists('file.txt')).toBe(false);
  });

  it('never escapes the upload directory with a traversal key', async () => {
    await service.save(Buffer.from('safe'), '../escape.txt');

    expect(await service.exists('escape.txt')).toBe(true);
    await expect(access(join(directory, '..', 'escape.txt'))).rejects.toThrow();
  });

  it('rejects a key that resolves outside the upload directory', async () => {
    await expect(service.save(Buffer.from('bad'), '..')).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });
});
