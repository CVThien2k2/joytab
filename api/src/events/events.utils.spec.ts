import { EventStatus } from '../generated/prisma/enums';
import {
  buildOccurrenceTiming,
  computeEventTotalCost,
  computeOccurrenceDates,
  formatTimeOfDay,
  isVotingLocked,
  parseTimeOfDay,
} from './events.utils';

/** 2026-08-13 là thứ Năm (ISO 4). 05:00Z = 12:00 giờ VN cùng ngày. */
const THU_2026_08_13 = new Date('2026-08-13T05:00:00Z');

describe('computeOccurrenceDates', () => {
  it('lấy đúng thứ trong tuần trong cửa sổ 14 ngày', () => {
    // Thứ Năm: chính hôm nay, rồi 20/8 và 27/8 — 27/8 đã nằm ngoài cửa sổ (offset 14).
    expect(computeOccurrenceDates(THU_2026_08_13, 14, 4)).toEqual(['2026-08-13', '2026-08-20']);
  });

  it('thứ đã qua trong tuần thì nhảy sang tuần sau', () => {
    // Thứ Hai (ISO 1) gần nhất tính từ thứ Năm là 17/8.
    expect(computeOccurrenceDates(THU_2026_08_13, 14, 1)).toEqual(['2026-08-17', '2026-08-24']);
  });

  it('Chủ nhật (ISO 7) tính đúng, không lẫn với quy ước 0 của getUTCDay', () => {
    expect(computeOccurrenceDates(THU_2026_08_13, 14, 7)).toEqual(['2026-08-16', '2026-08-23']);
  });

  it('cửa sổ 7 ngày chỉ ra đúng một buổi', () => {
    expect(computeOccurrenceDates(THU_2026_08_13, 7, 4)).toEqual(['2026-08-13']);
  });

  it('mốc bắt đầu nằm cuối ngày theo UTC vẫn tính theo ngày VN', () => {
    // 2026-08-13T18:00Z = 2026-08-14 01:00 giờ VN, tức đã sang thứ Sáu ở VN.
    const lateUtc = new Date('2026-08-13T18:00:00Z');
    expect(computeOccurrenceDates(lateUtc, 7, 5)).toEqual(['2026-08-14']);
  });
});

describe('buildOccurrenceTiming', () => {
  const template = {
    start_time: parseTimeOfDay('19:00'),
    end_time: parseTimeOfDay('21:00'),
    vote_lock_minutes_before: 120,
  };

  it('đổi giờ VN sang UTC đúng offset +07:00', () => {
    const timing = buildOccurrenceTiming(template, '2026-08-20');
    expect(timing.startAt.toISOString()).toBe('2026-08-20T12:00:00.000Z');
    expect(timing.endAt.toISOString()).toBe('2026-08-20T14:00:00.000Z');
  });

  it('vote_locked_at lùi đúng số phút trước giờ bắt đầu', () => {
    const timing = buildOccurrenceTiming(template, '2026-08-20');
    expect(timing.voteLockedAt.toISOString()).toBe('2026-08-20T10:00:00.000Z');
  });

  it('vote_lock_minutes_before = 0 thì khoá đúng lúc bắt đầu', () => {
    const timing = buildOccurrenceTiming({ ...template, vote_lock_minutes_before: 0 }, '2026-08-20');
    expect(timing.voteLockedAt.getTime()).toBe(timing.startAt.getTime());
  });

  it('buổi vắt qua nửa đêm thì endAt cộng thêm một ngày', () => {
    const overnight = {
      start_time: parseTimeOfDay('22:00'),
      end_time: parseTimeOfDay('00:30'),
      vote_lock_minutes_before: 60,
    };
    const timing = buildOccurrenceTiming(overnight, '2026-08-20');
    expect(timing.startAt.toISOString()).toBe('2026-08-20T15:00:00.000Z');
    expect(timing.endAt.toISOString()).toBe('2026-08-20T17:30:00.000Z');
    expect(timing.endAt.getTime()).toBeGreaterThan(timing.startAt.getTime());
  });

  it('end_time bằng start_time cũng hiểu là trọn 24 giờ, không phải 0 giờ', () => {
    const sameTime = {
      start_time: parseTimeOfDay('19:00'),
      end_time: parseTimeOfDay('19:00'),
      vote_lock_minutes_before: 0,
    };
    const timing = buildOccurrenceTiming(sameTime, '2026-08-20');
    expect(timing.endAt.getTime() - timing.startAt.getTime()).toBe(24 * 60 * 60 * 1000);
  });
});

describe('parseTimeOfDay / formatTimeOfDay', () => {
  it('đi vòng tròn không mất dữ liệu', () => {
    expect(formatTimeOfDay(parseTimeOfDay('19:30'))).toBe('19:30:00');
    expect(formatTimeOfDay(parseTimeOfDay('07:05:09'))).toBe('07:05:09');
  });
});

describe('isVotingLocked', () => {
  const startAt = new Date('2026-08-20T12:00:00Z');
  const voteLockedAt = new Date('2026-08-20T10:00:00Z');
  const openEvent = { status: EventStatus.OPEN, start_at: startAt, vote_locked_at: voteLockedAt };

  it('trước mốc khoá thì vote được', () => {
    expect(isVotingLocked(openEvent, new Date('2026-08-20T09:59:59Z'))).toBe(false);
  });

  it('đúng mốc khoá là đã khoá', () => {
    expect(isVotingLocked(openEvent, voteLockedAt)).toBe(true);
  });

  it('sau mốc khoá thì khoá', () => {
    expect(isVotingLocked(openEvent, new Date('2026-08-20T10:00:01Z'))).toBe(true);
  });

  it('vote_locked_at bị đặt sau giờ đánh thì giờ đánh vẫn chặn được', () => {
    const badLock = { ...openEvent, vote_locked_at: new Date('2026-08-20T23:00:00Z') };
    expect(isVotingLocked(badLock, startAt)).toBe(true);
  });

  it('trận không còn OPEN thì luôn khoá dù chưa tới mốc nào', () => {
    const completed = { ...openEvent, status: EventStatus.COMPLETED };
    expect(isVotingLocked(completed, new Date('2026-08-20T00:00:00Z'))).toBe(true);
    const cancelled = { ...openEvent, status: EventStatus.CANCELLED };
    expect(isVotingLocked(cancelled, new Date('2026-08-20T00:00:00Z'))).toBe(true);
  });
});

describe('computeEventTotalCost', () => {
  it('cộng tiền sân với mọi chi phí phát sinh', () => {
    const extraCosts = [
      { name: 'Cầu', amount: 120_000 },
      { name: 'Nước', amount: 30_000 },
    ];
    expect(computeEventTotalCost(200_000, extraCosts)).toBe(350_000);
  });

  it('không có chi phí phát sinh thì bằng đúng tiền sân', () => {
    expect(computeEventTotalCost(200_000, [])).toBe(200_000);
  });

  it('bỏ qua phần tử rác trong cột Json thay vì ném lỗi', () => {
    const dirty = [{ name: 'Cầu', amount: 120_000 }, { name: 'Thiếu amount' }, null, 'rác'];
    expect(computeEventTotalCost(200_000, dirty)).toBe(320_000);
  });

  it('cột Json không phải mảng thì coi như rỗng', () => {
    expect(computeEventTotalCost(200_000, null)).toBe(200_000);
  });
});
