import { ERROR_CODES, ErrorCodeItem } from '../constants/error-codes.constant';
import { MemberRole } from '../../generated/prisma/enums';

export type { ErrorCodeItem };

export type ErrorCode = keyof typeof ERROR_CODES;
export type ErrorCodeValue = (typeof ERROR_CODES)[ErrorCode]['code'];

/** Response thành công chuẩn — mọi handler đều được ResponseInterceptor bọc về dạng này. */
export type ApiSuccessResponse<T> = {
  success: true;
  message: string;
  data: T;
  meta?: Record<string, unknown>;
};

/**
 * Response lỗi chuẩn — mọi exception đều được HttpExceptionFilter bọc về dạng này.
 * FE xử lý theo `code`; `details` chỉ có với lỗi validate (mảng message của ValidationPipe).
 */
export type ApiErrorResponse = {
  success: false;
  code: ErrorCodeValue;
  message: string;
  details?: unknown;
};

/** Một response API bất kỳ: thành công hoặc lỗi. */
export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

/** Tư cách thành viên của user hiện tại trong org trên URL — do OrgMemberGuard gắn vào request. */
export type RequestMembership = {
  organizationId: string;
  userId: string;
  role: MemberRole;
};

export type GoogleUser = {
  provider: 'google';
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  fullName: string | null;
  avatarUrl: string | null;
};
