/**
 * Múi giờ nghiệp vụ cố định: Asia/Ho_Chi_Minh.
 *
 * Việt Nam không có DST từ 1975 nên offset là hằng số +07:00 vĩnh viễn. Dùng hằng số thay
 * vì kéo thêm thư viện timezone — cả dự án chỉ cần đúng hai phép đổi dưới đây.
 */
export const VN_UTC_OFFSET_HOURS = 7;
export const VN_UTC_OFFSET_MS = VN_UTC_OFFSET_HOURS * 60 * 60 * 1000;
export const VN_UTC_OFFSET_LABEL = '+07:00';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * Input: Ngày dạng `YYYY-MM-DD` và giờ dạng `HH:mm` hoặc `HH:mm:ss`, hiểu theo giờ VN.
 * Output: Date ở UTC tương ứng.
 */
export function vnDateTimeToUtc(isoDate: string, isoTime: string): Date {
  const time = isoTime.length === 5 ? `${isoTime}:00` : isoTime;
  return new Date(`${isoDate}T${time}${VN_UTC_OFFSET_LABEL}`);
}

/**
 * Input: Một thời điểm bất kỳ (UTC).
 * Output: Ngày lịch `YYYY-MM-DD` mà thời điểm đó rơi vào theo giờ VN.
 */
export function toVnDateString(instant: Date): string {
  return new Date(instant.getTime() + VN_UTC_OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * Input: Một thời điểm bất kỳ (UTC).
 * Output: Thứ trong tuần theo ISO-8601 tính ở giờ VN — 1 = thứ Hai … 7 = Chủ nhật.
 */
export function toVnIsoDayOfWeek(instant: Date): number {
  const shifted = new Date(instant.getTime() + VN_UTC_OFFSET_MS);
  const sundayFirst = shifted.getUTCDay();
  return sundayFirst === 0 ? 7 : sundayFirst;
}

/**
 * Input: Ngày `YYYY-MM-DD` và số ngày cần cộng.
 * Output: Chuỗi ngày `YYYY-MM-DD` sau khi cộng. Cộng trên mốc UTC-noon nên không bao giờ
 *         lệch ngày vì DST của môi trường chạy.
 */
export function addDaysToDateString(isoDate: string, days: number): string {
  const base = new Date(`${isoDate}T00:00:00Z`);
  return new Date(base.getTime() + days * MS_PER_DAY).toISOString().slice(0, 10);
}

/**
 * Input: Ngày `YYYY-MM-DD`.
 * Output: Date đại diện cho cột `@db.Date` của Postgres — Prisma đọc/ghi cột Date theo
 *         phần UTC của Date nên phải neo đúng 00:00:00Z, không dùng giờ địa phương.
 */
export function toDateOnly(isoDate: string): Date {
  return new Date(`${isoDate}T00:00:00Z`);
}
