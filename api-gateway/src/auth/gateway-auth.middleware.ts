import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';
import { AppException } from '../common/exceptions/app.exception';
import { ERROR_CODES } from '../common/constants/error-codes.constant';
import {
  DEVICE_COOKIE_NAME,
  HEADER_DEVICE_ID,
  HEADER_SESSION_ID,
  HEADER_USER_EMAIL,
  HEADER_USER_ID,
  SESSION_COOKIE_NAME,
} from '../session/session.constants';
import { SessionStoreService } from '../session/session-store.service';
import { isPublicPath } from './auth-paths';
import { IntrospectService } from './introspect.service';

@Injectable()
export class GatewayAuthMiddleware implements NestMiddleware {
  /**
   * Input: SessionStoreService để validate session qua Redis.
   * Output: Middleware edge-auth cho gateway.
   */
  constructor(
    private readonly sessionStore: SessionStoreService,
    private readonly introspectService: IntrospectService,
  ) {}

  /**
   * Input: request/response/next.
   * Output: Strip header X-User-* giả mạo; validate session Redis; inject identity khi hợp lệ.
   *         Route bảo vệ thiếu/sai session → 401; route public thì cho qua không identity.
   */
  async use(req: Request, _res: Response, next: NextFunction): Promise<void> {
    // Chống giả mạo: luôn xóa mọi header identity client tự gửi.
    delete req.headers[HEADER_USER_ID];
    delete req.headers[HEADER_USER_EMAIL];
    delete req.headers[HEADER_SESSION_ID];
    delete req.headers[HEADER_DEVICE_ID];

    const rawToken = readCookie(req.headers.cookie, SESSION_COOKIE_NAME);
    const deviceId = readCookie(req.headers.cookie, DEVICE_COOKIE_NAME);
    let session = rawToken ? await this.sessionStore.validate(rawToken) : null;
    // Cache-aside: Redis miss mà vẫn có cookie token → hỏi SSO (check Postgres + rehydrate Redis), tự lành khi Redis mất.
    if (!session && rawToken) {
      session = await this.introspectService.introspect(req.headers.cookie);
    }

    if (session !== null && session.deviceId === deviceId) {
      req.headers[HEADER_USER_ID] = session.userId;
      req.headers[HEADER_USER_EMAIL] = session.email;
      req.headers[HEADER_SESSION_ID] = session.sessionId;
      req.headers[HEADER_DEVICE_ID] = session.deviceId;
      next();
      return;
    }
    // Dùng originalUrl (full path) vì forRoutes('/auth') mount kiểu Express strip prefix khỏi req.path.
    if (isPublicPath(req.originalUrl.split('?')[0])) {
      next();
      return;
    }
    next(new AppException(ERROR_CODES.AUTH_001));
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
