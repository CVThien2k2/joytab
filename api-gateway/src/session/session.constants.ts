/** Hằng "session contract" — phải khớp với SSO (spec mục 7). */
const MS_PER_SECOND = 1000;
export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * MS_PER_SECOND;
export const SESSION_RENEW_THRESHOLD_MS = 24 * 60 * 60 * MS_PER_SECOND;
export const SESSION_KEY_PREFIX = 'session:';
export const SESSION_COOKIE_NAME = 'session_id';
export const DEVICE_COOKIE_NAME = 'device_id';
// Header identity gateway inject xuống downstream.
export const HEADER_USER_ID = 'x-user-id';
export const HEADER_USER_EMAIL = 'x-user-email';
export const HEADER_SESSION_ID = 'x-session-id';
export const HEADER_DEVICE_ID = 'x-device-id';
