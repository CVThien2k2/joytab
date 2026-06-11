import { CacheModule } from '@nestjs/cache-manager';
import { Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KeyvRedis, { createClient } from '@keyv/redis';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService) => {
        const logger = new Logger('RedisCache');
        const redisHost = getRequiredConfig(configService, 'REDIS_HOST', ERROR_CODES.SYS_009);
        const redisPort = getRequiredConfig(configService, 'REDIS_PORT', ERROR_CODES.SYS_010);
        const redisPassword = (configService.get<string>('REDIS_PASSWORD') ?? '').trim();
        const redisDb = getRequiredConfig(configService, 'REDIS_DB', ERROR_CODES.SYS_012);
        const redisAuthPart = redisPassword ? `:${redisPassword}@` : '';
        const redisUrl = `redis://${redisAuthPart}${redisHost}:${redisPort}/${redisDb}`;

        const client = createClient({
          url: redisUrl,
          socket: {
            reconnectStrategy: (retries) => {
              const delay = Math.min(retries * 1000, 10000);
              logger.warn(`Redis reconnecting (attempt ${retries + 1}) in ${delay / 1000}s...`);
              return delay;
            },
          },
        });

        client.on('connect', () => logger.log('Redis connecting...'));
        client.on('ready', () => logger.log('Redis connected'));
        client.on('error', (err: Error) => logger.error(`Redis error: ${err.message}`));

        await client.connect();

        return { stores: [new KeyvRedis(client)] };
      },
    }),
  ],
})
export class RedisCacheModule {}
