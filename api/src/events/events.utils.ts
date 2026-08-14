import { Prisma } from '../generated/prisma/client';
import { EventStatus } from '../generated/prisma/enums';
import { addDaysToDateString, toVnDateString, toVnIsoDayOfWeek, vnDateTimeToUtc } from '../common/utils/timezone';

const MS_PER_MINUTE = 60 * 1000;

/** Một dòng chi phí phát sinh trong `events.extra_costs`. */
export type ExtraCost = { name: string; amount: number };

/** Phần cấu hình template đủ để dựng ra một buổi cụ thể. */
export type OccurrenceTemplate = {
  start_time: Date;
  end_time: Date;
  vote_lock_minutes_before: number;
};

/** Ba mốc thời gian của một buổi, đã quy về UTC. */
export type OccurrenceTiming = {
  startAt: Date;
  endAt: Date;
  voteLockedAt: Date;
};

/**
 * Input: Giá trị cột `@db.Time` do Prisma trả về (Date neo ở 1970-01-01, phần giờ nằm ở UTC).
 * Output: Chuỗi `HH:mm:ss`.
 */
export function formatTimeOfDay(value: Date): string {
  return value.toISOString().slice(11, 19);
}

/**
 * Input: Chuỗi `HH:mm` hoặc `HH:mm:ss`.
 * Output: Date để ghi vào cột `@db.Time` — neo 1970-01-01 ở UTC, đúng cách Prisma đọc lại.
 */
export function parseTimeOfDay(value: string): Date {
  const time = value.length === 5 ? `${value}:00` : value;
  return new Date(`1970-01-01T${time}Z`);
}

/**
 * Input: Mốc bắt đầu cửa sổ (UTC), độ dài cửa sổ tính bằng ngày và thứ trong tuần (ISO 1–7).
 * Output: Các ngày `YYYY-MM-DD` theo giờ VN rơi đúng vào thứ đó trong cửa sổ, tính từ chính
 *         ngày hôm nay.
 */
export function computeOccurrenceDates(from: Date, windowDays: number, isoDayOfWeek: number): string[] {
  const firstDate = toVnDateString(from);
  const firstDayOfWeek = toVnIsoDayOfWeek(from);
  const offsetToFirstMatch = (isoDayOfWeek - firstDayOfWeek + 7) % 7;

  const dates: string[] = [];
  for (let offset = offsetToFirstMatch; offset < windowDays; offset += 7) {
    dates.push(addDaysToDateString(firstDate, offset));
  }

  return dates;
}

/**
 * Input: Cấu hình giờ của template và ngày diễn ra `YYYY-MM-DD` (giờ VN).
 * Output: `startAt` / `endAt` / `voteLockedAt` ở UTC.
 *
 * `end_time <= start_time` hiểu là buổi vắt qua nửa đêm nên `endAt` cộng thêm một ngày —
 * đánh cầu 22:00–00:30 là chuyện bình thường.
 */
export function buildOccurrenceTiming(template: OccurrenceTemplate, occurrenceDate: string): OccurrenceTiming {
  const startAt = vnDateTimeToUtc(occurrenceDate, formatTimeOfDay(template.start_time));
  const sameDayEnd = vnDateTimeToUtc(occurrenceDate, formatTimeOfDay(template.end_time));
  const endAt =
    sameDayEnd.getTime() <= startAt.getTime()
      ? vnDateTimeToUtc(addDaysToDateString(occurrenceDate, 1), formatTimeOfDay(template.end_time))
      : sameDayEnd;
  const voteLockedAt = new Date(startAt.getTime() - template.vote_lock_minutes_before * MS_PER_MINUTE);

  return { startAt, endAt, voteLockedAt };
}

/**
 * Input: Trạng thái + hai mốc thời gian của event, và thời điểm cần xét.
 * Output: true nếu KHÔNG còn vote được nữa.
 *
 * Ba điều kiện là "hoặc": tới giờ khoá, hoặc đã bắt đầu (phòng khi vote_locked_at bị đặt
 * sai thành sau giờ đánh), hoặc trận không còn OPEN.
 */
export function isVotingLocked(
  event: { status: EventStatus; vote_locked_at: Date; start_at: Date },
  now: Date,
): boolean {
  if (event.status !== EventStatus.OPEN) return true;

  return now.getTime() >= event.vote_locked_at.getTime() || now.getTime() >= event.start_at.getTime();
}

/**
 * Input: Giá trị cột Json `extra_costs` đọc từ DB.
 * Output: Mảng ExtraCost đã lọc bỏ phần tử không đúng dạng.
 *
 * Prisma trả Json là `unknown`; dữ liệu đã được DTO validate lúc ghi, hàm này chỉ để phía
 * đọc không phải ép kiểu bừa.
 */
export function parseExtraCosts(value: unknown): ExtraCost[] {
  if (!Array.isArray(value)) return [];

  return value.filter(
    (item): item is ExtraCost =>
      typeof item === 'object' &&
      item !== null &&
      typeof (item as ExtraCost).name === 'string' &&
      Number.isInteger((item as ExtraCost).amount),
  );
}

/**
 * Input: Danh sách chi phí đã qua DTO validate.
 * Output: Giá trị ghi được vào cột Json `extra_costs`.
 *
 * Ép kiểu là bắt buộc: `InputJsonValue` của Prisma đòi index signature mà object literal
 * có shape cố định không bao giờ thoả — dữ liệu đã được ExtraCostDto validate trước đó.
 */
export function toExtraCostsJson(extraCosts: ExtraCost[]): Prisma.InputJsonValue {
  return extraCosts.map((cost) => ({ name: cost.name, amount: cost.amount }));
}

/**
 * Input: Tiền sân và danh sách chi phí phát sinh.
 * Output: Tổng chi phí của buổi (VND).
 */
export function computeEventTotalCost(courtCost: number, extraCosts: unknown): number {
  return parseExtraCosts(extraCosts).reduce((sum, cost) => sum + cost.amount, courtCost);
}
