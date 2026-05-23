const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';

type ResolveGoogleRedirectInput = {
  redirectTo?: string;
  frontendOrigin?: string;
};

/**
 * Input: URL FE cấu hình và redirectTo nhận từ query/state trong luồng đăng nhập Google.
 * Output: Trả về URL redirect hợp lệ cùng origin FE; fallback về trang chủ FE nếu dữ liệu không hợp lệ.
 */
export function resolveGoogleLoginRedirectTarget({
  redirectTo,
  frontendOrigin,
}: ResolveGoogleRedirectInput): string {
  const baseUrl = normalizeFrontendOrigin(frontendOrigin);
  if (!redirectTo) {
    return baseUrl;
  }

  const normalizedCandidate = redirectTo.trim();
  if (!normalizedCandidate) {
    return baseUrl;
  }

  if (normalizedCandidate.startsWith('/')) {
    const relativeUrl = new URL(normalizedCandidate, `${baseUrl}/`);
    return relativeUrl.toString();
  }

  try {
    const parsedCandidate = new URL(normalizedCandidate);
    const parsedBase = new URL(`${baseUrl}/`);
    if (parsedCandidate.origin !== parsedBase.origin) {
      return baseUrl;
    }

    return parsedCandidate.toString();
  } catch {
    return baseUrl;
  }
}

/**
 * Input: URL redirect đích sau callback Google đã được chuẩn hóa.
 * Output: Trả URL đích cuối cùng kèm cờ success để FE xử lý luồng đăng nhập thành công.
 */
export function buildGoogleLoginSuccessRedirectUrl(targetUrl: string): string {
  const redirectUrl = new URL(targetUrl);
  redirectUrl.searchParams.set('loginProvider', 'google');
  redirectUrl.searchParams.set('loginStatus', 'success');

  const queryString = redirectUrl.searchParams.toString();
  const normalizedOrigin = redirectUrl.origin.replace(/\/+$/, '');
  const isRootPath =
    redirectUrl.pathname === '/' || redirectUrl.pathname === '';
  if (isRootPath) {
    return `${normalizedOrigin}?${queryString}`;
  }

  return redirectUrl.toString();
}

/**
 * Input: Giá trị FE base URL từ env (có thể rỗng).
 * Output: Trả base URL đã loại bỏ dấu `/` cuối; fallback localhost nếu env thiếu.
 */
function normalizeFrontendOrigin(frontendOrigin?: string): string {
  const rawBaseUrl = frontendOrigin?.trim() || DEFAULT_FRONTEND_ORIGIN;
  return rawBaseUrl.replace(/\/+$/, '');
}
