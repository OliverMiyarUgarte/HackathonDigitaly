import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TerminusModule } from '@nestjs/terminus';
import * as Joi from 'joi';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .default('development'),
        PORT: Joi.number().default(3001),
        DATABASE_URL: Joi.string().optional(),
        WEB_ORIGIN: Joi.string().default('http://localhost:3000'),
        JWT_SECRET: Joi.string().optional(),
        JWT_EXPIRES_IN: Joi.string().default('15m'),
        JWT_REFRESH_SECRET: Joi.string().optional(),
        JWT_REFRESH_EXPIRES_IN: Joi.string().default('7d'),
        MAIL_HOST: Joi.string().optional(),
        MAIL_PORT: Joi.number().optional(),
        MAIL_USER: Joi.string().allow('').optional(),
        MAIL_PASSWORD: Joi.string().allow('').optional(),
        MAIL_FROM: Joi.string().default('no-reply@digitaly.health'),
        AI_SERVICE_URL: Joi.string().default('http://localhost:8000'),
        UPLOAD_DIR: Joi.string().default('./uploads'),
      }),
    }),
    TerminusModule,
    HealthModule,
  ],
})
export class AppModule {}
