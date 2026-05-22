export const ERROR_CODES = {
  AUTH_001: {
    code: 'AUTH_001',
    message: 'Unauthorized',
  },
  AUTH_002: {
    code: 'AUTH_002',
    message: 'Google profile invalid',
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
    message: 'Missing GOOGLE_CALLBACK_URL',
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
  UNKNOWN_001: {
    code: 'UNKNOWN_001',
    message: 'Unknown error',
  },
} as const;
