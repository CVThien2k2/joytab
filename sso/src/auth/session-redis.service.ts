import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { SESSION_TTL_MS } from './auth.constants';

/** Giá trị session lưu trong Redis cho gateway đọc validate. */
export type SessionPayload = { userId: string; email: string; sessionId: string; deviceId: string };

@Injectable()
export class SessionRedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionRedisService.name);
  private client: RedisClientType;

  /**
   * Input: ConfigService chứa REDIS_HOST/PORT/PASSWORD/DB.
   * Output: Khởi tạo client node-redis (chưa kết nối — kết nối ở onModuleInit).
   */
  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    const password = (this.configService.get<string>('REDIS_PASSWORD') ?? '').trim();
    const db = this.configService.get<string>('REDIS_DB') ?? '0';
    const auth = password ? `:${password}@` : '';
    this.client = createClient({ url: `redis://${auth}${host}:${port}/${db}` });
    this.client.on('error', (err: Error) => this.logger.error(`Redis error: ${err.message}`));
  }

  /**
   * Input: Không có.
   * Output: Mở kết nối Redis khi module khởi động.
   */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
  }

  /**
   * Input: Không có.
   * Output: Đóng kết nối Redis khi app shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Input: token_hash của session + payload + TTL (ms, mặc định SESSION_TTL_MS).
   * Output: Ghi key session:{hash} = JSON payload với TTL để gateway validate.
   */
  async putSession(tokenHash: string, payload: SessionPayload, ttlMs: number = SESSION_TTL_MS): Promise<void> {
    await this.client.set(`session:${tokenHash}`, JSON.stringify(payload), { PX: ttlMs });
  }

  /**
   * Input: token_hash của session cần thu hồi.
   * Output: Xóa key Redis tương ứng (logout/revoke).
   */
  async deleteSession(tokenHash: string): Promise<void> {
    await this.client.del(`session:${tokenHash}`);
  }
}
