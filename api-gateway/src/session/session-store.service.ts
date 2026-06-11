import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash } from 'crypto';
import { createClient, RedisClientType } from 'redis';
import {
  SESSION_KEY_PREFIX,
  SESSION_RENEW_THRESHOLD_MS,
  SESSION_TTL_MS,
} from './session.constants';

export type SessionPayload = {
  userId: string;
  email: string;
  sessionId: string;
  deviceId: string;
};

@Injectable()
export class SessionStoreService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SessionStoreService.name);
  private client: RedisClientType;

  /**
   * Input: ConfigService chứa REDIS_*.
   * Output: Khởi tạo client node-redis (kết nối ở onModuleInit).
   */
  constructor(private readonly configService: ConfigService) {
    const host = this.configService.get<string>('REDIS_HOST');
    const port = this.configService.get<string>('REDIS_PORT');
    const password = (
      this.configService.get<string>('REDIS_PASSWORD') ?? ''
    ).trim();
    const db = this.configService.get<string>('REDIS_DB') ?? '0';
    const auth = password ? `:${password}@` : '';
    this.client = createClient({
      url: `redis://${auth}${host}:${port}/${db}`,
      disableOfflineQueue: true,
      socket: {
        reconnectStrategy: (retries) => Math.min(retries * 200, 5000),
      },
    });
    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  /**
   * Input: Không có.
   * Output: Kết nối Redis ở chế độ nền (không chặn boot). Redis chết lúc khởi động → gateway vẫn chạy,
   *         validate() sẽ fail-fast và auth middleware tự degrade sang core introspect cho tới khi Redis hồi.
   */
  onModuleInit(): void {
    void this.connectWithRetry();
  }

  /**
   * Input: số lần thử + delay giữa các lần (ms).
   * Output: Thử kết nối Redis tối đa maxAttempts lần; hết vẫn KHÔNG ném (gateway chạy degraded).
   */
  private async connectWithRetry(
    maxAttempts = 10,
    delayMs = 2_000,
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        await this.client.connect();
        this.logger.log('Redis connected');
        return;
      } catch (err) {
        this.logger.warn(
          `Redis connect lần ${attempt}/${maxAttempts} lỗi: ${err instanceof Error ? err.message : String(err)}`,
        );
        if (attempt < maxAttempts) {
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }
    this.logger.error(
      'Không kết nối được Redis sau khi retry — gateway chạy degraded (degrade sang core introspect).',
    );
  }

  /**
   * Input: Không có.
   * Output: Đóng kết nối khi shutdown.
   */
  async onModuleDestroy(): Promise<void> {
    await this.client.quit();
  }

  /**
   * Input: raw session token (từ cookie).
   * Output: SHA-256 hex để tra key Redis (khớp cách core băm token).
   */
  hashToken(rawToken: string): string {
    return createHash('sha256').update(rawToken).digest('hex');
  }

  /**
   * Input: raw session token từ cookie.
   * Output: SessionPayload nếu key còn sống (sliding-renew TTL nếu dưới ngưỡng); null nếu không có/hết hạn.
   */
  async validate(rawToken: string): Promise<SessionPayload | null> {
    const key = `${SESSION_KEY_PREFIX}${this.hashToken(rawToken)}`;
    const raw = await this.client.get(key);
    if (!raw) return null;
    const ttl = await this.client.pTTL(key);
    if (ttl >= 0 && ttl < SESSION_RENEW_THRESHOLD_MS) {
      await this.client.pExpire(key, SESSION_TTL_MS);
    }
    try {
      return JSON.parse(raw) as SessionPayload;
    } catch {
      return null;
    }
  }
}
