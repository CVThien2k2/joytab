/**
 * Nguồn sự thật duy nhất cho hằng số của luồng tổ chức.
 */

/**
 * Bảng chữ Crockford base32: 0-9 và A-Z nhưng BỎ I, L, O, U.
 * I/L dễ đọc thành 1, O thành 0, còn U bỏ để mã sinh ra không tình cờ thành từ thô tục.
 * Mã tham gia được đọc qua điện thoại / chép tay nên chống nhầm ký tự là yêu cầu thật.
 */
export const JOIN_CODE_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 8 ký tự trên 32 ký tự = 32^8 ≈ 1.1e12 tổ hợp. Đủ để đoán mò không có ý nghĩa. */
export const JOIN_CODE_LENGTH = 8;

/**
 * Regex của mã tham gia SAU khi chuẩn hoá. Khớp đúng JOIN_CODE_ALPHABET:
 * A-H, J, K, M, N, P-T, V-Z (thiếu I, L, O, U).
 */
export const JOIN_CODE_REGEX = /^[0-9A-HJKMNP-TV-Z]{8}$/;

/**
 * Sinh mã có thể trùng mã đã tồn tại (unique index sẽ chặn). Thử lại tối đa số lần này rồi
 * mới chịu thua — với không gian 1.1e12 mà trùng 5 lần liên tiếp thì lỗi nằm ở chỗ khác.
 */
export const JOIN_CODE_MAX_ATTEMPTS = 5;

export const MIN_ORGANIZATION_NAME_LENGTH = 2;
export const MAX_ORGANIZATION_NAME_LENGTH = 100;

/** Vai trò trong tổ chức. Lưu VarChar nên đây là nơi duy nhất liệt kê giá trị hợp lệ. */
export const ORGANIZATION_ROLES = ['owner', 'member'] as const;

/**
 * Giới hạn riêng cho các route NHẬN mã tham gia (xem trước bằng link, và vào bằng mã):
 * chúng trả lời được câu "mã này có thật không", nên là chỗ duy nhất trong module đáng để
 * dò tìm. Cùng ngưỡng với luồng đăng nhập (auth.constants.ts) — 60 req/phút mặc định của
 * ThrottlerModule là rộng cho mục đích đó.
 */
export const JOIN_CODE_THROTTLE_TTL_MS = 60_000;
export const JOIN_CODE_THROTTLE_LIMIT = 10;

/**
 * Phân trang của danh sách thành viên. `pageSize` có TRẦN vì đây là tham số client tự đặt:
 * không chặn thì một request `pageSize=100000` kéo cả bảng users ra khỏi DB.
 */
export const MEMBERS_DEFAULT_PAGE_SIZE = 20;
export const MEMBERS_MAX_PAGE_SIZE = 100;

/** Từ khoá tìm kiếm thành viên — dài hơn thế thì không còn là tên hay email nữa. */
export const MEMBER_SEARCH_MAX_LENGTH = 100;
