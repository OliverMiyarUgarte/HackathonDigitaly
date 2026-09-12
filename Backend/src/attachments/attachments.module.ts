import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MulterModule } from '@nestjs/platform-express';
import { AppointmentsModule } from '../appointments/appointments.module';
import { AttachmentsController } from './attachments.controller';
import { AttachmentsService } from './attachments.service';
import { LocalStorageService } from './storage/local-storage.service';
import { StorageService } from './storage/storage.service';

const DEFAULT_UPLOAD_MAX_BYTES = 10_485_760;

@Module({
  imports: [
    AppointmentsModule,
    MulterModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        limits: {
          fileSize: configService.get<number>(
            'UPLOAD_MAX_BYTES',
            DEFAULT_UPLOAD_MAX_BYTES,
          ),
        },
      }),
    }),
  ],
  controllers: [AttachmentsController],
  providers: [
    AttachmentsService,
    {
      provide: StorageService,
      inject: [ConfigService],
      useFactory: (configService: ConfigService): StorageService => {
        const driver = configService.get<string>('STORAGE_DRIVER', 'local');
        if (driver !== 'local') {
          throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
        }
        return new LocalStorageService(configService);
      },
    },
  ],
})
export class AttachmentsModule {}
