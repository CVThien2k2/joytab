import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { getRequiredConfig } from '../common/utils/functions';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(DatabaseService.name);

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
    const host = getRequiredConfig(configService, 'DB_HOST', ERROR_CODES.SYS_005);
    const user = getRequiredConfig(configService, 'DB_USER', ERROR_CODES.SYS_006);
    const password = getRequiredConfig(configService, 'DB_PASSWORD', ERROR_CODES.SYS_007);
    const database = getRequiredConfig(configService, 'DB_NAME', ERROR_CODES.SYS_008);
    return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@${host}:5432/${database}`;
  }

  /**
   * Input: Không có tham số đầu vào.
   * Output: Thiết lập kết nối Prisma đến database khi module khởi tạo.
   */
  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  private async connectWithRetry(delayMs = 3000): Promise<void> {
    let attempt = 0;
    while (true) {
      attempt++;
      try {
        this.logger.log(`Connecting to database (attempt ${attempt})...`);
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log('Database connected');
        return;
      } catch (err) {
        this.logger.error(
          `Connection failed: ${DatabaseService.extractErrorMessage(err)}. Retrying in ${delayMs / 1000}s...`,
        );
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  private static extractErrorMessage(err: unknown): string {
    if (!(err instanceof Error)) return String(err);
    const match = err.message.match(/Message: `([^`]+)`/);
    if (match) return match[1];
    const lastLine = err.message
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean)
      .pop();
    return lastLine ?? err.message;
  }

  /**
   * Input: Không có tham số đầu vào.
   * Output: Ngắt kết nối Prisma khỏi database khi module bị hủy.
   */
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
