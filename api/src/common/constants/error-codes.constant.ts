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
  UNKNOWN_001: {
    code: 'UNKNOWN_001',
    message: 'Unknown error',
  },
} as const;
