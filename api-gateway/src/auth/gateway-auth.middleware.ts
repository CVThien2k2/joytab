import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { Logger } from 'nestjs-pino';
import { AppException } from '../common/exceptions/app.exception';
import {
  ERROR_CODES,
  ErrorCodeItem,
} from '../common/constants/error-codes.constant';
import {
  DEVICE_COOKIE_NAME,
  HEADER_DEVICE_ID,
  HEADER_SESSION_ID,
  HEADER_USER_EMAIL,
  HEADER_USER_ID,
  SESSION_COOKIE_NAME,
} from '../session/session.constants';
import {
  SessionPayload,
  SessionStoreService,
} from '../session/session-store.service';
import { isPublicPath } from './auth-paths';
import { IntrospectService } from './introspect.service';

@Injectable()
export class GatewayAuthMiddleware implements NestMiddleware {
  /**
   * Input: SessionStoreService (Redis), IntrospectService (fallback core), Logger.
   * Output: Middleware edge-auth chịu lỗi cho gateway.
   */
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly introspectService: IntrospectService,
    private readonly logger: Logger,
  ) {}

  /**
   * Input: request/response/next.
   * Output: Strip header giả mạo; validate Redis (lỗi Redis → degrade introspect); inject identity khi hợp lệ.
   *         Route bảo vệ: sai/thiếu phiên → code core thật (AUTH_001/004/005); core timeout → SYS_504; core unreachable/5xx → SYS_502. Route public → cho qua.
   */
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    delete req.headers[HEADER_USER_ID];
    delete req.headers[HEADER_USER_EMAIL];
    delete req.headers[HEADER_SESSION_ID];
    delete req.headers[HEADER_DEVICE_ID];

    const rawToken = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    const deviceId = readCookie(req.headers.cookie, DEVICE_COOKIE_NAME);
    const publicPath = isPublicPath(req.originalUrl.split('?')[0]);

    if (!rawToken) {
      return this.deny(req, next, publicPath, ERROR_CODES.AUTH_001);
    }

    // 1) Thử Redis trước (nhanh). Redis chết → degrade, KHÔNG 500.
    let redisSession: SessionPayload | null = null;
    try {
      redisSession = await this.sessionStore.validate(rawToken);
    } catch (err) {
      this.logger.warn(
        `Redis validate lỗi, degrade sang introspect: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (redisSession) {
      if (redisSession.deviceId === deviceId) {
        this.inject(req, redisSession);
        next();
        return;
      }
      // Redis có nhưng sai device → từ chối (không introspect lại vô ích)
      return this.deny(req, next, publicPath, ERROR_CODES.AUTH_001);
    }

    // 2) Redis miss/lỗi: route public KHÔNG cần introspect → cho qua, tránh gọi core vô ích.
    if (publicPath) {
      next();
      return;
    }

    // 3) Route bảo vệ + Redis miss/lỗi → hỏi core (cache-aside / degrade).
    const result = await this.introspectService.introspect(rawToken, deviceId);
    if (result.status === 'ok' && result.payload.deviceId === deviceId) {
      this.inject(req, result.payload);
      next();
      return;
    }
    if (result.status === 'timeout') {
      // core nhận kết nối nhưng không phản hồi kịp → 504 (đồng nhất với proxy path)
      return this.deny(req, next, false, ERROR_CODES.SYS_504);
    }
    if (result.status === 'unreachable') {
      // không kết nối được core / core trả 5xx → 502 (đồng nhất với proxy path)
      return this.deny(req, next, false, ERROR_CODES.SYS_502);
    }
    // unauthorized (hoặc ok nhưng sai device) → propagate code core thật
    const code =
      result.status === 'unauthorized'
        ? (ERROR_CODES[result.code as keyof typeof ERROR_CODES] ??
          ERROR_CODES.AUTH_001)
        : ERROR_CODES.AUTH_001;
    return this.deny(req, next, false, code);
  }

  /**
   * Input: request + payload session hợp lệ.
   * Output: Gắn identity header tin cậy cho downstream.
   */
  private inject(req: Request, session: SessionPayload): void {
    req.headers[HEADER_USER_ID] = session.userId;
    req.headers[HEADER_USER_EMAIL] = session.email;
    req.headers[HEADER_SESSION_ID] = session.sessionId;
    req.headers[HEADER_DEVICE_ID] = session.deviceId;
  }

  /**
   * Input: request, next, cờ public, error code để dùng nếu route bảo vệ.
   * Output: Route public → cho qua không identity; route bảo vệ → next(AppException) đúng code.
   */
  private deny(
    req: Request,
    next: NextFunction,
    publicPath: boolean,
    error: ErrorCodeItem,
  ): void {
    if (publicPath) {
      next();
      return;
    }
    next(new AppException(error));
  }
}

/**
 * Input: header cookie thô + tên cookie.
 * Output: Giá trị cookie (decode) hoặc null.
 */
function readCookie(
  cookieHeader: string | undefined,
  name: string,
): string | null {
  if (!cookieHeader) return null;
  for (const pair of cookieHeader.split(';')) {
    const [k, ...v] = pair.trim().split('=');
    if (k === name) {
      const val = v.join('=');
      if (!val) return null;
      try {
        return decodeURIComponent(val);
      } catch {
        return val;
      }
    }
  }
  return null;
}
