import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './auth/auth.module';
// Redis tạm tắt — xem ghi chú ở mảng imports bên dưới.
// import { RedisCacheModule } from './cache/redis-cache.module';
import { AppLogger } from './common/loggers/app.logger';
import { RequestLoggerMiddleware } from './common/middleware/request-logger.middleware';
import { DatabaseModule } from './database/database.module';

const REQUIRED_ENV_KEYS = [
  'DB_HOST',
  'DB_USER',
  'DB_PASSWORD',
  'DB_NAME',
  // Redis tạm tắt — bật lại cùng RedisCacheModule.
  // 'REDIS_HOST',
  // 'REDIS_PORT',
  // 'REDIS_DB',
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
    ThrottlerModule.forRoot({
      throttlers: [{ name: 'global', ttl: 60000, limit: 60 }],
    }),
    // Redis tạm tắt: CacheModule được đăng ký global nhưng không service nào inject
    // CACHE_MANAGER — session lưu ở Postgres (UserSession.token_hash), ThrottlerModule
    // dùng in-memory store. Giữ lại vì dự kiến làm cache-aside cho validateSession.
    // RedisCacheModule,
    DatabaseModule,
    AuthModule,
  ],
  controllers: [],
  providers: [AppLogger, { provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestLoggerMiddleware).forRoutes('*');
  }
}
