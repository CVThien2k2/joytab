/**
 * Contract microservice gateway → core (TCP). Phải khớp core (core/src/auth/auth.constants.ts).
 */

/** Token DI cho ClientProxy nối tới core. */
export const CORE_CLIENT = 'CORE_CLIENT';
/** Message pattern introspect — gateway gọi khi Redis miss (cache-aside fallback). */
export const AUTH_INTROSPECT_PATTERN = 'auth.introspect';
/** Port TCP mặc định của core microservice (khớp CORE_TCP_PORT_DEFAULT bên core). */
export const CORE_TCP_PORT_DEFAULT = 8101;

/** Code AUTH_* core có thể trả về — dùng để phân biệt "core từ chối session" với lỗi hạ tầng. */
export const KNOWN_AUTH_CODES = new Set([
  'AUTH_001',
  'AUTH_004',
  'AUTH_005',
  'AUTH_006',
]);
