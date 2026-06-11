import { Inject, Injectable, Logger } from '@nestjs/common';
import { ClientProxy } from '@nestjs/microservices';
import { firstValueFrom, TimeoutError } from 'rxjs';
import { timeout } from 'rxjs/operators';
import { SessionPayload } from '../session/session-store.service';
import {
  AUTH_INTROSPECT_PATTERN,
  CORE_CLIENT,
  KNOWN_AUTH_CODES,
} from './core-client.constants';

export type IntrospectResult =
  | { status: 'ok'; payload: SessionPayload }
  | { status: 'unauthorized'; code: string } // code thật từ core: AUTH_001/004/005
  | { status: 'timeout' } // core nhận kết nối nhưng không phản hồi kịp → SYS_504
  | { status: 'unreachable' }; // không kết nối được core / core lỗi nội bộ → SYS_502

const INTROSPECT_TIMEOUT_MS =
  Number(process.env.INTROSPECT_TIMEOUT_MS) || 5_000;

/** Payload introspect gửi qua TCP (đã parse từ cookie). Khớp IntrospectMessage bên core. */
type IntrospectMessage = { sessionToken: string; deviceId: string };

@Injectable()
export class IntrospectService {
  private readonly logger = new Logger(IntrospectService.name);

  /**
   * Input: ClientProxy (TCP) nối tới core microservice.
   * Output: Service gọi core introspect khi Redis miss (cache-aside fallback).
   */
  constructor(@Inject(CORE_CLIENT) private readonly client: ClientProxy) {}

  /**
   * Input: session token + device id (đã parse từ cookie ở middleware).
   * Output: IntrospectResult — ok (kèm payload) / unauthorized (kèm code core) /
   *         timeout (core không phản hồi kịp → SYS_504) / unreachable (không kết nối được core
   *         hoặc core lỗi nội bộ → SYS_502).
   */
  async introspect(
    sessionToken: string | null | undefined,
    deviceId: string | null | undefined,
  ): Promise<IntrospectResult> {
    if (!sessionToken || !deviceId) {
      return { status: 'unauthorized', code: 'AUTH_001' };
    }
    try {
      const payload = await firstValueFrom(
        this.client
          .send<SessionPayload, IntrospectMessage>(AUTH_INTROSPECT_PATTERN, {
            sessionToken,
            deviceId,
          })
          .pipe(timeout(INTROSPECT_TIMEOUT_MS)),
      );
      if (payload?.userId) return { status: 'ok', payload };
      return { status: 'unauthorized', code: 'AUTH_001' };
    } catch (err) {
      // Hết timeout → core nhận kết nối nhưng không phản hồi kịp (SYS_504)
      if (err instanceof TimeoutError) {
        this.logger.error(
          `Introspect core timeout sau ${INTROSPECT_TIMEOUT_MS}ms`,
        );
        return { status: 'timeout' };
      }
      // RpcException kèm code AUTH_* → core từ chối session → propagate code thật
      const code = extractAuthCode(err);
      if (code) return { status: 'unauthorized', code };
      // Còn lại: không nối được core (ECONNREFUSED...) hoặc core lỗi nội bộ → unreachable (SYS_502)
      this.logger.error(
        `Introspect core lỗi: ${err instanceof Error ? err.message : safeStringify(err)}`,
      );
      return { status: 'unreachable' };
    }
  }
}

/**
 * Input: error mà ClientProxy emit khi RPC thất bại.
 * Output: code AUTH_* nếu core trả RpcException({ code }); null nếu là lỗi hạ tầng (kết nối/SYS_*).
 */
function extractAuthCode(err: unknown): string | null {
  if (err && typeof err === 'object' && 'code' in err) {
    const code = (err as { code?: unknown }).code;
    if (typeof code === 'string' && KNOWN_AUTH_CODES.has(code)) return code;
  }
  return null;
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}
