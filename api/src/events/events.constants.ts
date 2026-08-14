/** Nguồn sự thật cho các hằng số của module events. */

/** Cron sinh event nhìn trước bao nhiêu ngày. Đủ để thấy 2 buổi của lịch hàng tuần. */
export const EVENT_GENERATION_WINDOW_DAYS = 14;

/** Cron chạy 01:00 mỗi ngày theo giờ VN. */
export const EVENT_GENERATION_CRON = '0 1 * * *';
export const EVENT_GENERATION_TIMEZONE = 'Asia/Ho_Chi_Minh';

/** ISO-8601: 1 = thứ Hai … 7 = Chủ nhật. */
export const MIN_DAY_OF_WEEK = 1;
export const MAX_DAY_OF_WEEK = 7;

/** Trần sĩ số một buổi — chặn lỗi gõ nhầm chứ không phải giới hạn nghiệp vụ thật. */
export const MAX_PARTICIPANTS_LIMIT = 200;

/** Trần chi phí mỗi dòng (VND). Int của Postgres trần 2.147 tỷ, giữ cách xa mốc đó. */
export const MAX_COST_AMOUNT = 1_000_000_000;

/** Trần số phút khoá vote trước giờ đánh — 7 ngày. */
export const MAX_VOTE_LOCK_MINUTES_BEFORE = 7 * 24 * 60;

/** `HH:mm` hoặc `HH:mm:ss`. */
export const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;

export const DEFAULT_EVENT_PAGE_SIZE = 20;
export const MAX_EVENT_PAGE_SIZE = 100;
