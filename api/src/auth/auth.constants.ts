/**
 * Nguồn sự thật duy nhất cho mọi hằng số cấu hình của luồng auth.
 * Chỉnh ở đây là áp dụng cho toàn module — tránh khai báo cùng giá trị ở nhiều file.
 */

const MS_PER_SECOND = 1000;

// ===== TTL token (khai báo bằng giây; bản _MS dẫn xuất để tránh lệch giá trị) =====
/** Access token JWT sống 1 giờ. */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** Refresh token / session sống 7 ngày (tuyệt đối, không trượt theo hoạt động). */
// TODO(test): tạm để 1 phút để test luồng hết hạn / "Cần đăng nhập lại". Trả lại 7 * 24 * 60 * 60 khi xong.
export const REFRESH_TOKEN_TTL_SECONDS = 60;
/** Google change token + login code sống 60 giây (cookie tạm + cache đều dùng mốc này). */
export const GOOGLE_CHANGE_TOKEN_TTL_SECONDS = 60;

export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * MS_PER_SECOND;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * MS_PER_SECOND;
export const GOOGLE_CALLBACK_EXCHANGE_TTL_MS = GOOGLE_CHANGE_TOKEN_TTL_SECONDS * MS_PER_SECOND;

// ===== Độ dài token ngẫu nhiên (bytes) =====
export const GOOGLE_LOGIN_CODE_BYTES = 24;
export const CHANGE_TOKEN_BYTES = 24;
export const REFRESH_TOKEN_BYTES = 32;

// ===== JWT access token =====
export const ACCESS_TOKEN_ISSUER = 'joytab-api';
export const ACCESS_TOKEN_AUDIENCE = 'joytab-access';

// ===== Cookie =====
export const GOOGLE_CHANGE_TOKEN_COOKIE_NAME = 'google_change_token';
/** Path chung của refresh cookie per-account. */
export const REFRESH_TOKEN_COOKIE_PATH = '/auth';
/** Path hẹp riêng cho cookie change token ở bước exchange. */
export const GOOGLE_EXCHANGE_COOKIE_PATH = '/auth/google/exchange';
/** Tiền tố cookie refresh per-account: rt_<accountId>. */
export const REFRESH_COOKIE_PREFIX = 'rt_';

// ===== Cache (Redis) =====
export const CACHE_AUTH_CODE_PREFIX = 'auth:google:code:';

// ===== Rate limit (áp ở AuthController) =====
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;

// ===== FE origin fallback khi thiếu env FRONTEND_ORIGIN =====
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
