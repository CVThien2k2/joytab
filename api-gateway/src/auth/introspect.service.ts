import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionPayload } from '../session/session-store.service';

@Injectable()
export class IntrospectService {
  private readonly logger = new Logger(IntrospectService.name);
  private readonly coreUrl: string;

  /**
   * Input: ConfigService chứa CORE_URL.
   * Output: Service gọi core introspect khi Redis miss (cache-aside fallback).
   */
  constructor(private readonly configService: ConfigService) {
    this.coreUrl =
      this.configService.get<string>('CORE_URL') ?? 'http://localhost:8001';
  }

  /**
   * Input: header cookie thô của request (chứa session_id + device_id).
   * Output: SessionPayload nếu core xác nhận session hợp lệ (core đã rehydrate Redis); null nếu thiếu cookie/không hợp lệ/lỗi mạng.
   */
  async introspect(
    cookieHeader: string | undefined,
  ): Promise<SessionPayload | null> {
    if (!cookieHeader) return null;
    try {
      const res = await fetch(`${this.coreUrl}/auth/introspect`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
      });
      if (!res.ok) return null;
      // core bọc response qua ResponseInterceptor: { success, message, data }.
      const body = (await res.json()) as { data?: SessionPayload };
      return body.data ?? null;
    } catch (err) {
      this.logger.error(
        `Introspect core lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
