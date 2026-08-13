/** Một mục mã lỗi: mã nghiệp vụ ổn định + HTTP status + message mặc định. */
export interface ErrorCodeItem {
  code: string;
  status: number;
  message: string;
}

/**
 * Bộ mã lỗi chuẩn của dự án. `code` là hợp đồng ổn định giữa BE và FE — FE khớp theo
 * `code` để xử lý/hiển thị, KHÔNG dựa vào `message` (message có thể sửa hoặc đa ngôn ngữ).
 * `status` nhúng sẵn trong từng mã nên không còn bảng map code → status riêng.
 *
 * Chỉ giữ mã đang thực sự phát sinh trong code; thêm mã mới khi có nơi dùng.
 */
export const ERROR_CODES = {
  /** Token thiếu/sai chữ ký/malformed, hoặc user trong token không còn tồn tại. FE phải đăng nhập lại. */
  AUTH_001: { code: 'AUTH_001', status: 401, message: 'Unauthorized' },
  AUTH_002: { code: 'AUTH_002', status: 400, message: 'Google profile invalid' },
  AUTH_003: { code: 'AUTH_003', status: 401, message: 'Google login code invalid or expired' },
  /**
   * Access token hết hạn — và CHỈ hết hạn. FE dựa vào đúng mã này để gọi /auth/refresh,
   * nên token sai chữ ký/malformed phải trả AUTH_001 chứ không phải mã này.
   */
  AUTH_005: { code: 'AUTH_005', status: 401, message: 'Access token expired' },
  /** Refresh token thiếu/sai/hết hạn/không tồn tại/đã bị thu hồi. FE phải đăng nhập lại. */
  AUTH_006: { code: 'AUTH_006', status: 401, message: 'Refresh token invalid or expired' },

  VALIDATION_001: { code: 'VALIDATION_001', status: 400, message: 'Bad request' },

  SYS_001: { code: 'SYS_001', status: 500, message: 'Internal server error' },
  SYS_404: { code: 'SYS_404', status: 404, message: 'Resource not found' },

  // Lỗi cấu hình/hạ tầng: chỉ phát sinh lúc bootstrap hoặc khi hạ tầng chết, không phải
  // lỗi nghiệp vụ của client — luôn là 5xx.
  SYS_002: { code: 'SYS_002', status: 500, message: 'Missing GOOGLE_CLIENT_ID' },
  SYS_003: { code: 'SYS_003', status: 500, message: 'Missing GOOGLE_CLIENT_SECRET' },
  SYS_004: { code: 'SYS_004', status: 500, message: 'Missing API_URL' },
  SYS_005: { code: 'SYS_005', status: 500, message: 'Missing DB_HOST' },
  SYS_006: { code: 'SYS_006', status: 500, message: 'Missing DB_USER' },
  SYS_007: { code: 'SYS_007', status: 500, message: 'Missing DB_PASSWORD' },
  SYS_008: { code: 'SYS_008', status: 500, message: 'Missing DB_NAME' },
  SYS_013: { code: 'SYS_013', status: 500, message: 'Database connection failed' },
  SYS_014: { code: 'SYS_014', status: 500, message: 'Missing JWT_ACCESS_SECRET' },
} as const satisfies Record<string, ErrorCodeItem>;
