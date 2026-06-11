/**
 * Allowlist origin dùng chung cho CORS (main.ts) và CSRF guard — một nguồn sự thật.
 *
 * Hỗ trợ 2 dạng cấu hình (phân tách bằng dấu phẩy):
 *  - Exact origin:       https://app.example.com
 *  - Wildcard subdomain: https://*.example.com  (khớp mọi subdomain + apex example.com)
 *
 * Wildcard phù hợp với core cross-subdomain: mọi subdomain đều dùng chung cookie nên
 * đều được tin tưởng, khỏi phải liệt kê từng subdomain.
 */

export type OriginMatcher = {
  /** Giao thức kèm dấu hai chấm, ví dụ 'https:' (theo URL.protocol). */
  protocol: string;
  /** Host:port cho match chính xác (null nếu là wildcard). */
  host: string | null;
  /** Host gốc (kèm port) cho match wildcard subdomain (null nếu là exact). */
  baseHost: string | null;
};

/**
 * Input: Hàm đọc env (process.env hoặc ConfigService.get).
 * Output: Allowlist đã parse — ưu tiên CORS_ALLOWED_ORIGINS, fallback FRONTEND_ORIGIN.
 *         Dùng chung cho CORS (main.ts) và CSRF guard để cùng một nguồn cấu hình.
 */
export function resolveOriginAllowlist(
  get: (key: string) => string | undefined,
): OriginMatcher[] {
  return parseAllowedOrigins(
    get('CORS_ALLOWED_ORIGINS') ?? get('FRONTEND_ORIGIN'),
  );
}

/**
 * Input: Chuỗi origin phân tách bằng dấu phẩy (có thể undefined/rỗng).
 * Output: Danh sách matcher đã parse; bỏ qua entry rỗng/không hợp lệ.
 */
export function parseAllowedOrigins(
  raw: string | undefined | null,
): OriginMatcher[] {
  if (!raw) return [];
  return raw
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0)
    .map(toMatcher)
    .filter((matcher): matcher is OriginMatcher => matcher !== null);
}

/**
 * Input: Origin của request (header Origin/Referer) + allowlist đã parse.
 * Output: true nếu origin khớp một matcher trong allowlist (so khớp cả protocol).
 */
export function isOriginAllowed(
  origin: string | undefined | null,
  allowlist: OriginMatcher[],
): boolean {
  if (!origin) return false;
  let url: URL;
  try {
    url = new URL(origin);
  } catch {
    return false;
  }
  return allowlist.some((matcher) => {
    if (matcher.protocol !== url.protocol) return false;
    if (matcher.baseHost !== null) {
      return (
        url.host === matcher.baseHost ||
        url.host.endsWith(`.${matcher.baseHost}`)
      );
    }
    return matcher.host === url.host;
  });
}

/**
 * Input: Một entry allowlist (exact hoặc wildcard subdomain).
 * Output: OriginMatcher tương ứng, hoặc null nếu entry không parse được thành URL.
 */
function toMatcher(entry: string): OriginMatcher | null {
  const trimmed = entry.replace(/\/+$/, '');
  const isWildcard = trimmed.includes('://*.');
  // Bỏ '*.' để URL parse được host gốc; phần wildcard match xử lý lúc so khớp.
  const normalized = isWildcard ? trimmed.replace('://*.', '://') : trimmed;
  try {
    const url = new URL(normalized);
    return {
      protocol: url.protocol,
      host: isWildcard ? null : url.host,
      baseHost: isWildcard ? url.host : null,
    };
  } catch {
    return null;
  }
}
