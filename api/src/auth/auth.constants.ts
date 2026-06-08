/**
 * Nguồn sự thật duy nhất cho mọi hằng số cấu hình của luồng auth session-cookie.
 */

const MS_PER_SECOND = 1000;

// ===== TTL session =====
/** Session sống 7 ngày; trượt (gia hạn) khi thời gian còn lại dưới ngưỡng renew. */
export const SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;
/** Chỉ ghi DB gia hạn khi thời gian còn lại dưới 1 ngày — phần lớn request không ghi DB. */
export const SESSION_RENEW_THRESHOLD_SECONDS = 24 * 60 * 60;

export const SESSION_TTL_MS = SESSION_TTL_SECONDS * MS_PER_SECOND;
export const SESSION_RENEW_THRESHOLD_MS = SESSION_RENEW_THRESHOLD_SECONDS * MS_PER_SECOND;

// ===== Độ dài token ngẫu nhiên (bytes) =====
export const SESSION_TOKEN_BYTES = 32;

// ===== Cookie =====
export const SESSION_COOKIE_NAME = 'session_id';
export const DEVICE_COOKIE_NAME = 'device_id';
/** Cookie auth phải được gửi cho mọi route nên dùng path '/'. */
export const COOKIE_PATH = '/';
/** Device cookie sống dài (1 năm) để giữ định danh thiết bị qua nhiều phiên. */
export const DEVICE_COOKIE_MAX_AGE_MS = 365 * 24 * 60 * 60 * MS_PER_SECOND;

// ===== Rate limit (áp ở AuthController) =====
export const AUTH_THROTTLE_TTL_MS = 60_000;
export const AUTH_THROTTLE_LIMIT = 10;

// ===== FE origin fallback khi thiếu env FRONTEND_ORIGIN =====
export const DEFAULT_FRONTEND_ORIGIN = 'http://localhost:3000';
