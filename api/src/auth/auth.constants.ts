/**
 * Nguồn sự thật duy nhất cho mọi hằng số cấu hình của luồng auth JWT.
 */

const MS_PER_SECOND = 1000;

// ===== TTL token =====
/**
 * Access token sống 1 giờ và stateless — không tra DB. Đây cũng chính là cửa sổ mà việc
 * thu hồi CHƯA có hiệu lực: logout hoặc revoke RT chỉ chặn được refresh, còn AT đang cầm
 * vẫn dùng được tới khi hết hạn.
 */
export const ACCESS_TOKEN_TTL_SECONDS = 60 * 60;
/** Refresh token sống 7 ngày, reset lại mỗi lần rotate (trượt theo hoạt động của user). */
export const REFRESH_TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60;

export const ACCESS_TOKEN_TTL_MS = ACCESS_TOKEN_TTL_SECONDS * MS_PER_SECOND;
export const REFRESH_TOKEN_TTL_MS = REFRESH_TOKEN_TTL_SECONDS * MS_PER_SECOND;

// ===== Độ dài refresh token ngẫu nhiên (bytes) =====
/** 32 bytes random → 64 ký tự hex. Đủ entropy để hash SHA-256 trần không cần salt/KDF. */
export const REFRESH_TOKEN_BYTES = 32;

// ===== Cookie =====
export const ACCESS_COOKIE_NAME = 'at';
export const REFRESH_COOKIE_NAME = 'rt';
/** Cookie auth phải được gửi cho mọi route nên dùng path '/'. */
export const COOKIE_PATH = '/';

// ===== Claim `typ` trong access token =====
/** Chỉ AT là JWT nên chỉ có một loại; giữ claim để token lạ cùng secret vẫn bị từ chối. */
export const ACCESS_TOKEN_TYPE = 'at';

// ===== Rate limit (áp ở AuthController) =====
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;

// ===== FE origin fallback khi thiếu env FRONTEND_ORIGIN =====
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
