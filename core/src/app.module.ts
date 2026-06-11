import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { LoggerModule } from 'nestjs-pino';
import { randomUUID } from 'crypto';
import { AuthModule } from './auth/auth.module';
import { RedisCacheModule } from './cache/redis-cache.module';
import { DatabaseModule } from './database/database.module';
import { UsersModule } from './users/users.module';

const REQUIRED_ENV_KEYS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_DB',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'API_URL',
] as const;

/**
 * Input: Toàn bộ biến môi trường của tiến trình backend.
 * Output: Trả lại env hợp lệ hoặc ném lỗi ngay khi thiếu biến bắt buộc.
 */
function validateEnvironmentVariables(env: Record<string, unknown>): Record<string, unknown> {
  const missingKeys = REQUIRED_ENV_KEYS.filter((key) => {
    const value = env[key];
    return typeof value !== 'string' || value.trim().length === 0;
  });

  if (missingKeys.length > 0) {
    throw new Error(`Missing required environment variables: ${missingKeys.join(', ')}`);
  }

  return env;
}

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnvironmentVariables,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        /**
         * Input: request và response HTTP.
         * Output: correlation id cho request — ưu tiên X-Request-Id do gateway gắn,
         * không có thì tự sinh, và gắn ngược lại vào response header.
         */
        genReqId: (req, res) => {
          const incoming = req.headers['x-request-id'];
          const id = (typeof incoming === 'string' && incoming) || randomUUID();
          res.setHeader('x-request-id', id);
          return id;
        },
        customProps: () => ({ service: 'core' }),
        // Log gọn: chỉ giữ reqId/method/url + status, bỏ toàn bộ header rác.
        serializers: {
          req: (req: { id: string | number; method: string; url: string }) => ({
            id: req.id,
            method: req.method,
            url: req.url,
          }),
          res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
          err: (err: Error & { code?: string }) => ({
            type: err.name,
            message: err.message,
            code: err.code,
          }),
        },
        autoLogging: true,
        level: process.env.LOG_LEVEL ?? 'info',
        redact: [
          'req.headers.cookie',
          'req.headers.authorization',
          'req.body.password',
          'req.body.token',
          'req.body.code',
          'req.body.secret',
        ],
        transport:
          process.env.NODE_ENV === 'production' ? undefined : { target: 'pino-pretty', options: { singleLine: true } },
      },
    }),
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60000, limit: 60 }],
    }),
    RedisCacheModule,
    DatabaseModule,
    AuthModule,
    UsersModule,
  ],
  controllers: [],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
