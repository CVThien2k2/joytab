import { DEFAULT_FRONTEND_ORIGIN, REFRESH_COOKIE_PREFIX } from './auth.constants';

/**
 * Input: FRONTEND_ORIGIN và callback code một lần do backend tạo.
 * Output: Trả URL callback FE cố định `/login/callback` kèm mã code.
 */
export function buildGoogleLoginCallbackRedirectUrl(frontendOrigin: string | undefined, callbackCode: string): string {
  const normalizedCode = callbackCode.trim();
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  const redirectUrl = new URL('/login/callback', `${baseUrl}/`);
  redirectUrl.searchParams.set('code', normalizedCode);
  return redirectUrl.toString();
}

/**
 * Input: FRONTEND_ORIGIN từ env (có thể rỗng).
 * Output: Trả URL login FE cố định để fallback khi callback Google không thành công.
 */
export function buildGoogleLoginFailedRedirectUrl(frontendOrigin: string | undefined): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  return new URL('/login', `${baseUrl}/`).toString();
}

/**
 * Input: Header cookie thô từ request và tên cookie cần đọc.
 * Output: Trả giá trị cookie nếu tồn tại, ngược lại trả null.
 */
export function readCookieValue(cookieHeader: string | undefined, cookieName: string): string | null {
  if (!cookieHeader) {
    return null;
  }

  const cookiePairs = cookieHeader.split(';');
  for (const pair of cookiePairs) {
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
 * Output: Trả base URL đã loại bỏ dấu `/` cuối; fallback localhost nếu env thiếu.
 */
function normalizeFrontendOrigin(frontendOrigin?: string): string {
  const rawBaseUrl = frontendOrigin?.trim() || DEFAULT_FRONTEND_ORIGIN;
  return rawBaseUrl.replace(/\/+$/, '');
}

/**
 * Input: Chuỗi User-Agent từ request (có thể undefined).
 * Output: Tên platform để hiển thị (Windows/macOS/iOS/Android/Linux) hoặc null nếu không nhận diện được.
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
 * Input: Chuỗi User-Agent của request (có thể undefined).
 * Output: Tên trình duyệt suy ra từ UA để làm device name, hoặc null nếu không nhận diện được.
 */
export function parseDeviceNameFromUserAgent(userAgent: string | undefined): string | null {
  if (!userAgent) {
    return null;
  }
  const ua = userAgent.toLowerCase();
  // Thứ tự quan trọng: Edge/Opera/Brave chứa chuỗi 'chrome' nên phải kiểm tra trước Chrome.
  if (ua.includes('edg/') || ua.includes('edga') || ua.includes('edgios')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('firefox') || ua.includes('fxios')) return 'Firefox';
  if (ua.includes('chrome') || ua.includes('crios')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  return null;
}

/**
 * Input: accountId (user.id nội bộ).
 * Output: Tên cookie refresh token riêng cho account đó, vd 'rt_<uuid>'.
 */
export function buildRefreshCookieName(accountId: string): string {
  return `${REFRESH_COOKIE_PREFIX}${accountId}`;
}

/**
 * Input: Header cookie thô từ request.
 * Output: Mọi cặp { accountId, rawToken } suy từ các cookie rt_<accountId> browser gửi kèm.
 *         Dùng cho endpoint check status: chỉ xét các account mà browser thật sự đang giữ cookie.
 */
export function readRefreshCookies(cookieHeader: string | undefined): { accountId: string; rawToken: string }[] {
  if (!cookieHeader) {
    return [];
  }
  const result: { accountId: string; rawToken: string }[] = [];
  for (const pair of cookieHeader.split(';')) {
    const [name, ...valueParts] = pair.trim().split('=');
    if (!name.startsWith(REFRESH_COOKIE_PREFIX)) {
      continue;
    }
    const accountId = name.slice(REFRESH_COOKIE_PREFIX.length);
    const rawValue = valueParts.join('=');
    if (!accountId || !rawValue) {
      continue;
    }
    let rawToken: string;
    try {
      rawToken = decodeURIComponent(rawValue);
    } catch {
      rawToken = rawValue;
    }
    result.push({ accountId, rawToken });
  }
  return result;
}
