const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
export const GOOGLE_CHANGE_TOKEN_COOKIE_NAME = 'google_change_token';
export const GOOGLE_CALLBACK_EXCHANGE_TTL_MS = 60_000;
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token';
export const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

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
