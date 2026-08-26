import { ConfigService } from '@nestjs/config';
import { CookieOptions } from 'express';
import { isProductionEnvironment } from '../common/utils/functions';
import { COOKIE_PATH, DEFAULT_FRONTEND_ORIGIN } from './auth.constants';

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL trang chủ FE. Cookie `at`/`rt` đã được set ở response redirect này, nên FE
 *         chỉ cần vào `/`: proxy của FE thấy cookie là cho qua, còn user do Next server gọi
 *         /auth/me lấy về. Không còn trang trung gian `/login/callback`.
 */
export function buildPostLoginRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/', `${baseUrl}/`).toString();
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL login FE cố định để fallback khi callback Google thất bại.
 */
export function buildGoogleLoginFailedRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/login', `${baseUrl}/`).toString();
}

/**
 * Input: ConfigService (COOKIE_DOMAIN, NODE_ENV) và tuổi cookie (ms).
 * Output: Cookie options dùng chung cho cả `at` và `rt`.
 *         COOKIE_DOMAIN (vd .example.com) để cookie first-party dùng chung FE + API subdomain.
 *         Không set ở dev → cookie host-only cho localhost.
 */
export function buildAuthCookieOptions(configService: ConfigService, maxAgeMs: number): CookieOptions {
  const domain = configService.get<string>('COOKIE_DOMAIN')?.trim();
  return {
    httpOnly: true,
    secure: isProductionEnvironment(configService),
    sameSite: 'lax',
    path: COOKIE_PATH,
    maxAge: maxAgeMs,
    ...(domain ? { domain } : {}),
  };
}

/**
 * Input: Header cookie thô và tên cookie cần đọc.
 * Output: Giá trị cookie (đã decode) nếu có, ngược lại null.
 */
export function readCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }
  for (const pair of cookieHeader.split(';')) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (name !== cookieName) {
      continue;
    }
    const rawValue = valueParts.join('=');
    if (!rawValue) {
      return null;
    }
    try {
      return decodeURIComponent(rawValue);
    } catch {
      return rawValue;
    }
  }
  return null;
}

/**
 * Input: Giá trị FE base URL từ env (có thể rỗng).
 * Output: Base URL đã loại bỏ dấu `/` cuối; fallback localhost nếu thiếu.
 */
function normalizeFrontendOrigin(frontendOrigin?: string): string {
  const rawBaseUrl = frontendOrigin?.trim() || DEFAULT_FRONTEND_ORIGIN;
  return rawBaseUrl.replace(/\/+$/, '');
}
