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
 * Input: Giá trị `returnTo`/`state` do FE gửi lên (có thể là bất cứ thứ gì).
 * Output: Path tương đối an toàn để redirect về, hoặc null nếu không dùng được.
 *
 *         Đây là hàng rào chống open-redirect: giá trị này đi vòng qua Google rồi mới quay
 *         lại nên coi như dữ liệu từ người ngoài. Chỉ nhận path bắt đầu bằng MỘT dấu `/`
 *         — `//evil.com` và `/\evil.com` đều bị browser hiểu là host khác, còn
 *         `https://evil.com` thì khỏi bàn. Ký tự cho phép đủ dùng cho path + query.
 */
export function sanitizeReturnToPath(rawValue: unknown): string | null {
  if (typeof rawValue !== 'string') return null;
  const value = rawValue.trim();
  if (!value.startsWith('/') || value.startsWith('//')) return null;
  if (value.includes('\\') || value.includes('://')) return null;
  return /^\/[A-Za-z0-9\-._~!$&'()*+,;=:@%/?]*$/.test(value) ? value : null;
}

/**
 * Input: FRONTEND_ORIGIN + path tương đối ĐÃ qua sanitizeReturnToPath.
 * Output: URL tuyệt đối trên chính origin của FE.
 */
export function buildFrontendUrl(frontendOrigin: string | undefined, path: string): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL(path, `${baseUrl}/`).toString();
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL trang onboarding FE. Dùng khi login xong mà user chưa khai đủ thông tin —
 *         redirect thẳng tới đây thay vì để `/` rồi proxy đá lại một nhịp nữa.
 */
export function buildOnboardingRedirectUrl(frontendOrigin: string | undefined, returnTo?: string | null): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  const url = new URL('/onboarding', `${baseUrl}/`);
  // Giữ đích cuối qua bước khai thông tin: khai xong FE tự đi tiếp tới đây, không rơi về `/`.
  if (returnTo) url.searchParams.set('next', returnTo);
  return url.toString();
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
