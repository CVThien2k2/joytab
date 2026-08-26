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
