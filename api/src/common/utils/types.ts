import { ERROR_CODES } from '../constants/error-codes.constant';

export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCodeItem = (typeof ERROR_CODES)[ErrorCode];
export type ErrorCodeValue = ErrorCodeItem['code'];

export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

export type ApiErrorResponse = {
  success: false;
  code: ErrorCodeValue;
  details?: Record<string, unknown>;
  message: string;
};

export type GoogleUser = {
  provider: 'google';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  avatarUrl: string | null;
};
