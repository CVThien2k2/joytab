import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class DatabaseService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  /**
   * Input: ConfigService chứa các biến DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.
   * Output: Khởi tạo PrismaClient với URL kết nối được dựng từ cấu hình môi trường.
   */
  constructor(configService: ConfigService) {
    super({
      adapter: new PrismaPg({
        connectionString: DatabaseService.buildDatabaseUrl(configService),
      }),
    });
  }

  /**
   * Input: ConfigService chứa thông tin host, user, password, db của PostgreSQL.
   * Output: Trả về connection string PostgreSQL đầy đủ cho Prisma.
   */
  private static buildDatabaseUrl(configService: ConfigService): string {
    const host = getRequiredConfig(
      configService,
      'DB_HOST',
      ERROR_CODES.SYS_005,
    );
    const user = getRequiredConfig(
      configService,
      'DB_USER',
      ERROR_CODES.SYS_006,
    );
    const password = getRequiredConfig(
      configService,
      'DB_PASSWORD',
      ERROR_CODES.SYS_007,
    );
    const database = getRequiredConfig(
      configService,
      'DB_NAME',
      ERROR_CODES.SYS_008,
    );
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`;
  }

  /**
   * Input: Không có tham số đầu vào.
   * Output: Thiết lập kết nối Prisma đến database khi module khởi tạo.
   */
  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * Input: Không có tham số đầu vào.
   * Output: Ngắt kết nối Prisma khỏi database khi module bị hủy.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
