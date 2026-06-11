import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SessionPayload } from '../session/session-store.service';

export type IntrospectResult =
  | { status: 'ok'; payload: SessionPayload }
  | { status: 'unauthorized'; code: string } // code thật từ core: AUTH_001/004/005
  | { status: 'upstream_error' }; // core không kết nối được / 5xx

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
   * Output: IntrospectResult — ok (kèm payload) / unauthorized (kèm code core) / upstream_error (core lỗi/không reachable).
   */
  async introspect(
    cookieHeader: string | undefined,
  ): Promise<IntrospectResult> {
    if (!cookieHeader) return { status: 'unauthorized', code: 'AUTH_001' };
    try {
      const res = await fetch(`${this.coreUrl}/v1/auth/introspect`, {
        method: 'POST',
        headers: { cookie: cookieHeader },
      });
      if (res.ok) {
        const body = (await res.json()) as { data?: SessionPayload };
        if (body.data) return { status: 'ok', payload: body.data };
        return { status: 'unauthorized', code: 'AUTH_001' };
      }
      if (res.status === 401 || res.status === 403) {
        // core từ chối session: đọc code thật để propagate (AUTH_001/004/005/006)
        const body = (await res.json().catch(() => null)) as {
          code?: string;
        } | null;
        return { status: 'unauthorized', code: body?.code ?? 'AUTH_001' };
      }
      // 5xx hoặc status lạ → coi như upstream error
      this.logger.warn(`Core introspect trả ${res.status}`);
      return { status: 'upstream_error' };
    } catch (err) {
      this.logger.error(
        `Introspect core lỗi: ${err instanceof Error ? err.message : String(err)}`,
      );
      return { status: 'upstream_error' };
    }
  }
}
