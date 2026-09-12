import type { ReadStream } from 'node:fs';

export abstract class StorageService {
  abstract save(buffer: Buffer, storageKey: string): Promise<void>;
  abstract createReadStream(storageKey: string): ReadStream;
  abstract remove(storageKey: string): Promise<void>;
  abstract exists(storageKey: string): Promise<boolean>;
}
