export const ERROR_CODES = {
  AUTH_001: { code: 'AUTH_001', message: 'Unauthorized' },
  AUTH_004: { code: 'AUTH_004', message: 'Session revoked' },
  AUTH_005: { code: 'AUTH_005', message: 'Session expired' },
  AUTH_006: { code: 'AUTH_006', message: 'Request origin not allowed' },
  SYS_404: { code: 'SYS_404', message: 'Resource not found' },
  SYS_001: { code: 'SYS_001', message: 'Internal server error' },
  SYS_502: { code: 'SYS_502', message: 'Upstream service unavailable' },
  SYS_503: { code: 'SYS_503', message: 'Service temporarily unavailable' },
  SYS_504: { code: 'SYS_504', message: 'Gateway timeout' },
} as const;

export type ErrorCodeItem = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
