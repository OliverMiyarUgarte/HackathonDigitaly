import { BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { ReadStream } from 'node:fs';
import { createReadStream } from 'node:fs';
import { access, mkdir, rm, writeFile } from 'node:fs/promises';
import { basename, isAbsolute, join, relative, resolve } from 'node:path';
import { StorageService } from './storage.service';

const DEFAULT_UPLOAD_DIR = './uploads';

export class LocalStorageService extends StorageService {
  constructor(private readonly configService: ConfigService) {
    super();
  }

  async save(buffer: Buffer, storageKey: string): Promise<void> {
    const target = this.resolvePath(storageKey);
    await mkdir(this.baseDir(), { recursive: true });
    await writeFile(target, buffer);
  }

  createReadStream(storageKey: string): ReadStream {
    return createReadStream(this.resolvePath(storageKey));
  }

  async remove(storageKey: string): Promise<void> {
    await rm(this.resolvePath(storageKey), { force: true });
  }

  async exists(storageKey: string): Promise<boolean> {
    try {
      await access(this.resolvePath(storageKey));
      return true;
    } catch {
      return false;
    }
  }

  private baseDir(): string {
    return resolve(
      this.configService.get<string>('UPLOAD_DIR', DEFAULT_UPLOAD_DIR),
    );
  }

  private resolvePath(storageKey: string): string {
    const base = this.baseDir();
    const safeName = basename(storageKey);
    if (safeName.length === 0 || safeName === '.' || safeName === '..') {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: 'Invalid storage key',
      });
    }

    const target = join(base, safeName);
    const nested = relative(base, target);
    if (nested.startsWith('..') || isAbsolute(nested)) {
      throw new BadRequestException({
        errorCode: 'VALIDATION_FAILED',
        message: 'Invalid storage key',
      });
    }
    return target;
  }
}
