import { ERROR_CODES, ErrorCodeItem } from '../constants/error-codes.constant';

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

/**
 * Profile thô do Google trả về sau OAuth (google.strategy.ts) — CHỈ những gì Google biết.
 * Không chứa dữ liệu do user tự khai ở onboarding.
 */
export type GoogleUser = {
  provider: 'google';
  providerUserId: string;
  email: string;
  fullName: string | null;
  avatarUrl: string | null;
};

/** Giới tính user tự khai ở bước onboarding. */
export const GENDERS = ['male', 'female', 'other'] as const;
export type Gender = (typeof GENDERS)[number];

/**
 * User trả cho FE ở /auth/me, /auth/refresh và /auth/onboarding. Là GoogleUser cộng thêm
 * phần user tự khai; `onboarded` là cờ FE/proxy dựa vào để quyết định cho vào app hay không.
 */
export type UserProfile = GoogleUser & {
  age: number | null;
  gender: Gender | null;
  phone: string | null;
  onboarded: boolean;
};

/** Vai trò của một user trong một tổ chức. Nguồn giá trị: ORGANIZATION_ROLES. */
export type OrganizationRole = 'owner' | 'member';

/**
 * Một tổ chức nhìn từ góc độ user đang hỏi — nên có cả `role` và `joinCode` (chỉ owner thấy).
 * Cùng shape cho GET /organizations, POST /organizations và POST /organizations/join.
 */
export type OrganizationSummary = {
  id: string;
  name: string;
  role: OrganizationRole;
  /** null với member: chỉ owner cần mã để chia sẻ. */
  joinCode: string | null;
  joinByCodeEnabled: boolean;
  memberCount: number;
  /** ISO 8601 — thời điểm user đang hỏi vào tổ chức này. */
  joinedAt: string;
};
