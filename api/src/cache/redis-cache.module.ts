import { CacheModule } from '@nestjs/cache-manager';
import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import KeyvRedis from '@keyv/redis';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';

@Module({
  imports: [
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      /**
       * Input: ConfigService chứa các biến REDIS_HOST/REDIS_PORT/REDIS_PASSWORD/REDIS_DB.
       * Output: Trả cấu hình CacheModule dùng Redis store cho toàn hệ thống.
       */
      useFactory: (configService: ConfigService) => {
        const redisHost = getRequiredConfig(configService, 'REDIS_HOST', ERROR_CODES.SYS_009);
        const redisPort = getRequiredConfig(configService, 'REDIS_PORT', ERROR_CODES.SYS_010);
        const redisPassword = getRequiredConfig(configService, 'REDIS_PASSWORD', ERROR_CODES.SYS_011).trim();
        const redisDb = getRequiredConfig(configService, 'REDIS_DB', ERROR_CODES.SYS_012);
        const redisAuthPart = redisPassword ? `:${redisPassword}@` : '';
        const redisUrl = `redis://${redisAuthPart}${redisHost}:${redisPort}/${redisDb}`;

        return {
          stores: [new KeyvRedis(redisUrl)],
        };
      },
    }),
  ],
})
export class RedisCacheModule {}
