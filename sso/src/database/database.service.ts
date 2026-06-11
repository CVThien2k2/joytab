import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import { AppException } from '../common/exceptions/app.exception';
import { buildPostgresUrl } from '../common/utils/database-url';
import { getRequiredConfig } from '../common/utils/functions';
import { PrismaClient } from '../generated/prisma/client';

@Injectable()
export class DatabaseService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private static readonly MAX_CONNECT_ATTEMPTS = 5;
  private static readonly RETRY_DELAY_MS = 3000;
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
   * Input: ConfigService chứa thông tin host, user, password, db (+ DB_PORT, DB_PARAMS tùy chọn).
   * Output: Connection string PostgreSQL đầy đủ cho Prisma; thiếu biến bắt buộc thì ném SYS_005–008.
   */
  private static buildDatabaseUrl(configService: ConfigService): string {
    return buildPostgresUrl({
      host: getRequiredConfig(configService, 'DB_HOST', ERROR_CODES.SYS_005),
      user: getRequiredConfig(configService, 'DB_USER', ERROR_CODES.SYS_006),
      password: getRequiredConfig(configService, 'DB_PASSWORD', ERROR_CODES.SYS_007),
      database: getRequiredConfig(configService, 'DB_NAME', ERROR_CODES.SYS_008),
      port: configService.get<string>('DB_PORT'),
      params: configService.get<string>('DB_PARAMS'),
    });
  }

  /**
   * Input: Không có tham số đầu vào.
   * Output: Thiết lập kết nối Prisma đến database khi module khởi tạo.
   */
  async onModuleInit(): Promise<void> {
    await this.connectWithRetry();
  }

  private async connectWithRetry(
    maxAttempts = DatabaseService.MAX_CONNECT_ATTEMPTS,
    delayMs = DatabaseService.RETRY_DELAY_MS,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        this.logger.log(`Connecting to database (attempt ${attempt}/${maxAttempts})...`);
        await this.$connect();
        await this.$queryRaw`SELECT 1`;
        this.logger.log('Database connected');
        return;
      } catch (err) {
        const reason = DatabaseService.extractErrorMessage(err);
        // Hết số lần retry → fail-fast: log fatal và ném lỗi để app dừng khởi động
        // (init() reject → bootstrap().catch → exit(1)) thay vì treo vô hạn âm thầm.
        if (attempt >= maxAttempts) {
          this.logger.error(`Connection failed after ${maxAttempts} attempts: ${reason}. Aborting startup.`);
          throw new AppException(ERROR_CODES.SYS_013);
        }
        this.logger.error(
          `Connection failed: ${reason}. Retrying in ${delayMs / 1000}s... (${attempt}/${maxAttempts})`,
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
