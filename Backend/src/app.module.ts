import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TerminusModule } from '@nestjs/terminus';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import * as Joi from 'joi';
import { AiModule } from './ai/ai.module';
import { AppointmentsModule } from './appointments/appointments.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { AuthModule } from './auth/auth.module';
import { AuditModule } from './common/audit/audit.module';
import { RequestContextModule } from './common/context/request-context.module';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { LoggingInterceptor } from './common/interceptors/logging.interceptor';
import { ConsultationsModule } from './consultations/consultations.module';
import { HealthModule } from './health/health.module';
import { MailModule } from './mail/mail.module';
import { PrismaModule } from './prisma/prisma.module';
import { RealtimeModule } from './realtime/realtime.module';
import { RecordsModule } from './records/records.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().required(),
        WEB_ORIGIN: Joi.string().default('http://localhost:3000'),
        JWT_SECRET: Joi.string().required(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        ALLOW_DOCTOR_SELF_REGISTRATION: Joi.boolean().default(false),
        SWAGGER_ENABLED: Joi.boolean().default(false),
        MAIL_HOST: Joi.string().optional(),
        MAIL_PORT: Joi.number().optional(),
        MAIL_USER: Joi.string().allow('').optional(),
        MAIL_PASSWORD: Joi.string().allow('').optional(),
        MAIL_FROM: Joi.string().default('no-reply@digitaly.health'),
        OTP_PEPPER: Joi.string().required(),
        OTP_TTL_SECONDS: Joi.number().integer().positive().default(600),
        OTP_MAX_ATTEMPTS: Joi.number().integer().positive().default(5),
        AI_SERVICE_URL: Joi.string().default('http://localhost:8000'),
        AI_BASE_URL: Joi.string().allow('').optional(),
        AI_WS_URL: Joi.string().allow('').optional(),
        AI_INTERNAL_TOKEN: Joi.string().required(),
        UPLOAD_DIR: Joi.string().default('./uploads'),
        UPLOAD_MAX_BYTES: Joi.number().integer().positive().default(10_485_760),
        STORAGE_DRIVER: Joi.string().valid('local').default('local'),
        STUN_URLS: Joi.string().default('stun:stun.l.google.com:19302'),
        TURN_URLS: Joi.string().optional(),
        TURN_USERNAME: Joi.string().allow('').optional(),
        TURN_CREDENTIAL: Joi.string().allow('').optional(),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 120 }]),
    TerminusModule,
    PrismaModule,
    RequestContextModule,
    AuditModule,
    HealthModule,
    AuthModule,
    AiModule,
    AppointmentsModule,
    AttachmentsModule,
    MailModule,
    RealtimeModule,
    ConsultationsModule,
    RecordsModule,
    UsersModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: HttpExceptionFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LoggingInterceptor,
    },
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
