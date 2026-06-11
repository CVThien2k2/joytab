import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NextFunction, Request, Response } from 'express';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import {
  isOriginAllowed,
  OriginMatcher,
  resolveOriginAllowlist,
} from '../utils/origin.util';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

@Injectable()
export class CsrfMiddleware implements NestMiddleware {
  private readonly logger = new Logger(CsrfMiddleware.name);
  private readonly allowlist: OriginMatcher[];

  /**
   * Input: ConfigService đọc allowlist origin.
   * Output: Middleware CSRF parse allowlist sẵn.
   */
  constructor(private readonly configService: ConfigService) {
    this.allowlist = resolveOriginAllowlist((key) =>
      this.configService.get<string>(key),
    );
  }

  /**
   * Input: request/response/next.
   * Output: Cho qua method an toàn; mutation phải có Origin/Referer thuộc allowlist, không thì ném AUTH_006.
   */
  use(req: Request, _res: Response, next: NextFunction): void {
    if (SAFE_METHODS.has(req.method)) {
      next();
      return;
    }
    const origin = req.headers.origin ?? originFromReferer(req.headers.referer);
    if (!isOriginAllowed(origin, this.allowlist)) {
      this.logger.warn(
        `CSRF chặn ${req.method} ${req.url} — origin: ${origin ?? '(none)'}`,
      );
      // Dùng next(err) (không throw): throw trong middleware sync thoát khỏi
      // cơ chế .catch(next) của Nest → ra Express default 500. next(err) giữ đúng AppException.
      next(new AppException(ERROR_CODES.AUTH_006));
      return;
    }
    next();
  }
}

/**
 * Input: header referer.
 * Output: origin trích từ referer hoặc null.
 */
function originFromReferer(referer: string | undefined): string | null {
  if (!referer) return null;
  try {
    return new URL(referer).origin;
  } catch {
    return null;
  }
}
