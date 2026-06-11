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
    this.client = createClient({ url: `redis://${auth}${host}:${port}/${db}` });
    this.client.on('error', (err: Error) =>
      this.logger.error(`Redis error: ${err.message}`),
    );
  }

  /**
   * Input: Không có.
   * Output: Mở kết nối Redis khi gateway khởi động.
   */
  async onModuleInit(): Promise<void> {
    await this.client.connect();
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
