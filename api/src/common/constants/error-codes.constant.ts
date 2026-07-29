export const ERROR_CODES = {
  AUTH_001: {
    code: 'AUTH_001',
    message: 'Unauthorized',
  },
  AUTH_002: {
    code: 'AUTH_002',
    message: 'Google profile invalid',
  },
  AUTH_003: {
    code: 'AUTH_003',
    message: 'Google login code invalid or expired',
  },
  /**
   * Access token hết hạn — và CHỈ hết hạn. FE dựa vào đúng mã này để gọi /auth/refresh,
   * nên token sai chữ ký/malformed phải trả AUTH_001 chứ không phải mã này.
   */
  AUTH_005: {
    code: 'AUTH_005',
    message: 'Access token expired',
  },
  /** Refresh token thiếu/sai/hết hạn/không tồn tại/đã bị thu hồi. FE phải đăng nhập lại. */
  AUTH_006: {
    code: 'AUTH_006',
    message: 'Refresh token invalid or expired',
  },
  VALIDATION_001: {
    code: 'VALIDATION_001',
    message: 'Bad request',
  },
  SYS_404: {
    code: 'SYS_404',
    message: 'Resource not found',
  },
  SYS_001: {
    code: 'SYS_001',
    message: 'Internal server error',
  },
  SYS_002: {
    code: 'SYS_002',
    message: 'Missing GOOGLE_CLIENT_ID',
  },
  SYS_003: {
    code: 'SYS_003',
    message: 'Missing GOOGLE_CLIENT_SECRET',
  },
  SYS_004: {
    code: 'SYS_004',
    message: 'Missing API_URL',
  },
  SYS_005: {
    code: 'SYS_005',
    message: 'Missing DB_HOST',
  },
  SYS_006: {
    code: 'SYS_006',
    message: 'Missing DB_USER',
  },
  SYS_007: {
    code: 'SYS_007',
    message: 'Missing DB_PASSWORD',
  },
  SYS_008: {
    code: 'SYS_008',
    message: 'Missing DB_NAME',
  },
  SYS_009: {
    code: 'SYS_009',
    message: 'Missing REDIS_HOST',
  },
  SYS_010: {
    code: 'SYS_010',
    message: 'Missing REDIS_PORT',
  },
  SYS_011: {
    code: 'SYS_011',
    message: 'Missing REDIS_PASSWORD',
  },
  SYS_012: {
    code: 'SYS_012',
    message: 'Missing REDIS_DB',
  },
  SYS_013: {
    code: 'SYS_013',
    message: 'Database connection failed',
  },
  SYS_014: {
    code: 'SYS_014',
    message: 'Missing JWT_ACCESS_SECRET',
  },
  UNKNOWN_001: {
    code: 'UNKNOWN_001',
    message: 'Unknown error',
  },
} as const;
