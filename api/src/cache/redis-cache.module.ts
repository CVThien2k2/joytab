/**
 * TẠM TẮT — toàn bộ module được comment, không import vào AppModule nữa.
 *
 * Lý do: CacheModule đăng ký global nhưng không service nào inject CACHE_MANAGER.
 * Auth giờ là JWT: access token verify in-memory không chạm DB, refresh token chỉ tra
 * Postgres (`refresh_tokens`) mỗi giờ một lần lúc rotate — không có gì cần cache.
 * ThrottlerModule dùng in-memory store. Redis vì thế chỉ còn là dependency chặn bootstrap: `await
 * client.connect()` + reconnectStrategy retry vô hạn khiến app không bao giờ listen
 * khi Redis chết.
 *
 * Bật lại:
 *   1. Uncomment file này.
 *   2. Uncomment `RedisCacheModule` (import + mảng imports) trong app.module.ts.
 *   3. Uncomment REDIS_HOST / REDIS_PORT / REDIS_DB trong REQUIRED_ENV_KEYS.
 *   4. Uncomment REDIS_* trong api/.env, rồi `docker compose up -d redis`.
 * Cân nhắc bỏ `await client.connect()` để Redis lỗi không chặn bootstrap.
 */

// import { CacheModule } from '@nestjs/cache-manager';
// import { Logger, Module } from '@nestjs/common';
// import { ConfigService } from '@nestjs/config';
// import KeyvRedis, { createClient } from '@keyv/redis';
// import { ERROR_CODES } from '../common/constants/error-codes.constant';
// import { getRequiredConfig } from '../common/utils/functions';

// @Module({
//   imports: [
//     CacheModule.registerAsync({
//       isGlobal: true,
//       inject: [ConfigService],
//       useFactory: async (configService: ConfigService) => {
//         const logger = new Logger('RedisCache');
//         const redisHost = getRequiredConfig(configService, 'REDIS_HOST', ERROR_CODES.SYS_009);
//         const redisPort = getRequiredConfig(configService, 'REDIS_PORT', ERROR_CODES.SYS_010);
//         const redisPassword = (configService.get<string>('REDIS_PASSWORD') ?? '').trim();
//         const redisDb = getRequiredConfig(configService, 'REDIS_DB', ERROR_CODES.SYS_012);
//         const redisAuthPart = redisPassword ? `:${redisPassword}@` : '';
//         const redisUrl = `redis://${redisAuthPart}${redisHost}:${redisPort}/${redisDb}`;
//
//         const client = createClient({
//           url: redisUrl,
//           socket: {
//             reconnectStrategy: (retries) => {
//               const delay = Math.min(retries * 1000, 10000);
//               logger.warn(`Redis reconnecting (attempt ${retries + 1}) in ${delay / 1000}s...`);
//               return delay;
//             },
//           },
//         });
//
//         client.on('connect', () => logger.log('Redis connecting...'));
//         client.on('ready', () => logger.log('Redis connected'));
//         client.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));
//
//         await client.connect();
//
//         return { stores: [new KeyvRedis(client)] };
//       },
//     }),
//   ],
// })
// export class RedisCacheModule {}

export {};
