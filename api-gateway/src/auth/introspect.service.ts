import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionPayload } from '../session/session-store.service';

@Injectable()
export class IntrospectService {
  private readonly logger = new Logger(IntrospectService.name);
  private readonly ssoUrl: string;

  /**
   * Input: ConfigService chứa SSO_URL.
   * Output: Service gọi SSO introspect khi Redis miss (cache-aside fallback).
   */
  constructor(private readonly configService: ConfigService) {
    this.ssoUrl =
      this.configService.get<string>('SSO_URL') ?? 'http://localhost:8001';
  }

  /**
   * Input: header cookie thô của request (chứa session_id + device_id).
   * Output: SessionPayload nếu SSO xác nhận session hợp lệ (SSO đã rehydrate Redis); null nếu thiếu cookie/không hợp lệ/lỗi mạng.
   */
  async introspect(
    cookieHeader: string | undefined,
  ): Promise<SessionPayload | null> {
    if (!cookieHeader) return null;
    try {
      const res = await fetch(`${this.ssoUrl}/auth/introspect`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
      });
      if (!res.ok) return null;
      // SSO bọc response qua ResponseInterceptor: { success, message, data }.
      const body = (await res.json()) as { data?: SessionPayload };
      return body.data ?? null;
    } catch (err) {
      this.logger.error(
        `Introspect SSO lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
      return null;
    }
  }
}
