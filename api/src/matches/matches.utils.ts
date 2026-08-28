import { Gender } from '../common/utils/types';
import { MONEY_ROUNDING_UNIT } from './matches.constants';

/** Một người tham gia, ở mức tối thiểu cần cho việc chia tiền. */
export type SplitParticipant = { userId: string; gender: Gender | null };

/** Một dòng chi phí, ở mức tối thiểu cần cho việc chia tiền. */
export type SplitExpense = { quantity: number; unitPrice: number };

/** Phần chia của một người. */
export type SplitShare = { userId: string; ratio: number; amount: number };

export type SplitResult = {
  total: number;
  charges: SplitShare[];
  /** Σ tiền từng người − tổng chi. Luôn ≥ 0 vì mọi khoản đều làm tròn LÊN. */
  surplus: number;
};

/**
 * Input: giới tính một người + hệ số nam của trận.
 * Output: Hệ số áp cho người đó.
 *
 *         Nữ là mốc 1. 'other' và CHƯA KHAI đều tính như nam: thiếu thông tin thì nghiêng
 *         về phía không thất thu quỹ, còn hơn để quỹ âm rồi ai đó phải bù.
 */
export function ratioFor(gender: Gender | null, maleRatio: number): number {
  return gender === 'female' ? 1 : maleRatio;
}

/**
 * Input: hai số nguyên không âm.
 * Output: Phép chia LÀM TRÒN LÊN, bằng số nguyên.
 *
 *         Cần vì `Math.ceil(a / b)` đi qua số thực: 3 chia 3 có thể ra 0.9999999999 rồi
 *         ceil thành 1 (may) hoặc 1.0000000001 rồi ceil thành 2 (hỏng). Tiền thì không
 *         được phép "có lúc".
 */
function ceilDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator);
}

/**
 * Input: danh sách người tham gia, danh sách dòng chi phí (ĐƠN GIÁ), hệ số nam.
 * Output: Tổng chi, số tiền từng người (đã làm tròn lên nghìn) và phần dư vào quỹ.
 *
 *         Công thức: tổng chia cho tổng "suất", mỗi người trả số suất của mình.
 *         Nữ 1 suất, nam `maleRatio` suất. Hệ số 1.2 nghĩa là nam đóng gấp 1.2 lần nữ.
 *
 *         TOÀN BỘ phép tính chạy trên SỐ NGUYÊN: hệ số nhân 100 lên (Decimal(4,2) ở DB nên
 *         không mất gì), rồi chia nguyên có làm tròn lên. Nếu tính bằng số thực thì cùng
 *         một trận, tính lại hai lần có thể ra hai kết quả lệch 1.000đ — và đó đúng là con
 *         số người dùng sẽ đem ra so với nhau.
 *
 *         Trả `charges` rỗng khi không có người hoặc tổng bằng 0; người gọi quyết định đó
 *         có phải lỗi hay không (chốt chi phí thì có, xem preview thì không).
 */
export function splitExpenses(params: {
  participants: SplitParticipant[];
  expenses: SplitExpense[];
  maleRatio: number;
}): SplitResult {
  const total = params.expenses.reduce((sum, expense) => sum + expense.quantity * expense.unitPrice, 0);

  // Hệ số × 100 để mọi thứ về số nguyên. 1.2 → 120 suất-phần-trăm.
  const scaled = params.participants.map((participant) => {
    const ratio = ratioFor(participant.gender, params.maleRatio);
    return { userId: participant.userId, ratio, units: Math.round(ratio * 100) };
  });
  const totalUnits = scaled.reduce((sum, item) => sum + item.units, 0);

  if (totalUnits === 0 || total <= 0) {
    return {
      total,
      charges: scaled.map((item) => ({ userId: item.userId, ratio: item.ratio, amount: 0 })),
      surplus: 0,
    };
  }

  const charges = scaled.map((item) => ({
    userId: item.userId,
    ratio: item.ratio,
    // ceil(total × units / totalUnits / 1000) × 1000, làm một lần bằng số nguyên.
    amount: ceilDiv(total * item.units, totalUnits * MONEY_ROUNDING_UNIT) * MONEY_ROUNDING_UNIT,
  }));

  const collected = charges.reduce((sum, charge) => sum + charge.amount, 0);
  return { total, charges, surplus: collected - total };
}

/**
 * Input: hai khoảng thời gian [aStart, aEnd) và [bStart, bEnd).
 * Output: true nếu chúng giao nhau.
 *
 *         Nửa mở ở đầu cuối: trận 19h-21h và trận 21h-23h KHÔNG coi là trùng — chạy từ sân
 *         này sang sân kia lúc 21h là chuyện người chơi tự lo, hệ thống không cấm.
 */
export function overlaps(aStart: Date, aEnd: Date, bStart: Date, bEnd: Date): boolean {
  return aStart < bEnd && bStart < aEnd;
}
