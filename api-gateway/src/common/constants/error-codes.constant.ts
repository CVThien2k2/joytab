export const ERROR_CODES = {
  AUTH_001: { code: 'AUTH_001', message: 'Unauthorized' },
  AUTH_005: { code: 'AUTH_005', message: 'Session expired' },
  AUTH_006: { code: 'AUTH_006', message: 'Request origin not allowed' },
} as const;

export type ErrorCodeItem = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
