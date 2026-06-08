import { DEFAULT_FRONTEND_ORIGIN } from './auth.constants';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Input: Giá trị bất kỳ từ cookie/param.
 * Output: true nếu là chuỗi UUID hợp lệ — chặn truy vấn Prisma bằng id rác.
 */
export function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string' && UUID_RE.test(value);
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: URL callback FE cố định `/login/callback` (không còn kèm code).
 */
export function buildGoogleLoginCallbackRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/login/callback', `${baseUrl}/`).toString();
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

/**
 * Input: Chuỗi User-Agent (có thể undefined).
 * Output: Tên platform (Windows/macOS/iOS/Android/Linux) hoặc null.
 */
export function parsePlatformFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('linux')) return 'Linux';
  return null;
}

/**
 * Input: Chuỗi User-Agent (có thể undefined).
 * Output: Tên trình duyệt làm device name, hoặc null.
 */
export function parseDeviceNameFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent.toLowerCase();
  if (ua.includes('edg/') || ua.includes('edga') || ua.includes('edgios')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Firefox';
  if (ua.includes('chrome') || ua.includes('crios')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return null;
}
