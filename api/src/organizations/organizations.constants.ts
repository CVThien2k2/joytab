/** Nguồn sự thật cho các hằng số của module organizations. */

/** 32 bytes random → 64 ký tự hex. Cùng độ mạnh với refresh token, đủ để hash SHA-256 trần. */
export const INVITE_TOKEN_BYTES = 32;

/** Giới hạn độ dài tên tổ chức — khớp @db.VarChar(255) trong schema. */
export const ORGANIZATION_NAME_MAX_LENGTH = 255;

/** Trần số ngày hiệu lực của một invite link, để không ai lỡ tay tạo link sống 100 năm. */
export const INVITE_MAX_EXPIRES_IN_DAYS = 365;

/** Trần số lượt dùng của một invite link. */
export const INVITE_MAX_USES_LIMIT = 1000;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const INVITE_EXPIRES_DAY_IN_MS = MS_PER_DAY;
