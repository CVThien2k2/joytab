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

  // ===== Organizations =====
  ORG_001: { code: 'ORG_001', status: 404, message: 'Organization not found' },
  /**
   * 403 chứ không phải 404: request đã qua JwtAuthGuard nên danh tính đã rõ, che giấu sự
   * tồn tại của org không đem lại gì mà lại làm FE khó phân biệt "sai id" với "không có quyền".
   */
  ORG_002: { code: 'ORG_002', status: 403, message: 'Not a member of this organization' },
  ORG_003: { code: 'ORG_003', status: 403, message: 'Admin role required' },
  /** Bất biến: một tổ chức luôn còn ít nhất một ADMIN đang ACTIVE. */
  ORG_004: { code: 'ORG_004', status: 409, message: 'Organization must keep at least one admin' },
  ORG_005: { code: 'ORG_005', status: 409, message: 'Already a member' },
  ORG_006: { code: 'ORG_006', status: 404, message: 'Member not found' },

  // ===== Invites =====
  INV_001: { code: 'INV_001', status: 404, message: 'Invite not found' },
  INV_002: { code: 'INV_002', status: 410, message: 'Invite expired, revoked or used up' },

  // ===== Events =====
  EVT_001: { code: 'EVT_001', status: 404, message: 'Event not found' },
  EVT_002: { code: 'EVT_002', status: 409, message: 'Event is full' },
  EVT_003: { code: 'EVT_003', status: 409, message: 'Voting is locked for this event' },
  EVT_004: { code: 'EVT_004', status: 409, message: 'Event is not open' },
  EVT_005: { code: 'EVT_005', status: 409, message: 'Event has no confirmed attendee' },
  EVT_006: { code: 'EVT_006', status: 409, message: 'Event cannot be reopened after any payment' },
  TPL_001: { code: 'TPL_001', status: 404, message: 'Event template not found' },

  // ===== Billing =====
  PAY_001: { code: 'PAY_001', status: 404, message: 'Payment not found' },
  PAY_002: { code: 'PAY_002', status: 409, message: 'Payment is not pending' },
  PAY_003: { code: 'PAY_003', status: 400, message: 'Allocations do not match payment amount' },
  PAY_004: { code: 'PAY_004', status: 409, message: 'Allocation exceeds remaining debt' },
  SET_001: { code: 'SET_001', status: 404, message: 'Settlement not found' },
} as const satisfies Record<string, ErrorCodeItem>;
