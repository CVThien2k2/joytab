import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
import { AppLogger } from './common/loggers/app.logger';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { DatabaseModule } from './database/database.module';
import { OrganizationsModule } from './organizations/organizations.module';

const REQUIRED_ENV_KEYS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  'GOOGLE_CLIENT_ID',
  'GOOGLE_CLIENT_SECRET',
  'API_URL',
  // Chỉ access token là JWT; refresh token là chuỗi random nên không cần secret.
  'JWT_ACCESS_SECRET',
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
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60000, limit: 60 }],
    }),
    DatabaseModule,
    AuthModule,
    OrganizationsModule,
  ],
  controllers: [],
  providers: [AppLogger, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
