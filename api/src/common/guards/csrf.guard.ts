import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Request } from 'express';
import { CSRF_SAFE_METHODS } from '../../auth/auth.constants';
import { ERROR_CODES } from '../constants/error-codes.constant';
import { AppException } from '../exceptions/app.exception';
import { isOriginAllowed, OriginMatcher, resolveOriginAllowlist } from '../utils/origin.util';

/**
 * Bảo vệ CSRF cho mô hình SSO cross-subdomain (web-only).
 *
 * Vì cookie dùng SameSite=Lax được coi là same-site giữa các subdomain cùng domain cha,
 * cookie session vẫn tự động gửi kèm request cross-subdomain → cần chặn theo Origin.
 * Với mọi method đổi trạng thái, yêu cầu header Origin (fallback Referer) phải nằm trong
 * allowlist. Method an toàn (GET/HEAD/OPTIONS), gồm cả OAuth redirect, được bỏ qua.
 */
@Injectable()
export class CsrfGuard implements CanActivate {
  private readonly logger = new Logger(CsrfGuard.name);
  private readonly allowlist: OriginMatcher[];

  /**
   * Input: ConfigService để đọc allowlist origin lúc khởi tạo.
   * Output: Guard với allowlist đã parse sẵn (parse một lần, không lặp lại mỗi request).
   */
  constructor(private readonly configService: ConfigService) {
    this.allowlist = resolveOriginAllowlist((key) => this.configService.get<string>(key));
  }

  /**
   * Input: ExecutionContext của request HTTP.
   * Output: true nếu method an toàn hoặc Origin/Referer thuộc allowlist; ném AUTH_006 (403) nếu không.
   */
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    if (CSRF_SAFE_METHODS.has(request.method)) {
      return true;
    }
    const origin = this.resolveRequestOrigin(request);
    if (!isOriginAllowed(origin, this.allowlist)) {
      this.logger.warn(`CSRF chặn ${request.method} ${request.url} — origin: ${origin ?? '(none)'}`);
      throw new AppException(ERROR_CODES.AUTH_006);
    }
    return true;
  }

  /**
   * Input: Request hiện tại.
   * Output: Origin từ header Origin, fallback origin trích từ Referer; null nếu không có.
   */
  private resolveRequestOrigin(request: Request): string | null {
    const origin = request.headers.origin;
    if (typeof origin === 'string' && origin.length > 0) {
      return origin;
    }
    const referer = request.headers.referer;
    if (typeof referer === 'string' && referer.length > 0) {
      try {
        return new URL(referer).origin;
      } catch {
        return null;
      }
    }
    return null;
  }
}
