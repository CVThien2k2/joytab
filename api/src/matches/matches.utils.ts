import { Gender } from '../common/utils/types';

/** Một người tham gia, ở mức tối thiểu cần cho việc chia tiền. */
export type SplitParticipant = { userId: string; gender: Gender | null };

/** Một dòng chi phí, ở mức tối thiểu cần cho việc chia tiền. */
export type SplitExpense = { quantity: number; unitPrice: number };

/** Phần chia của một người. */
export type SplitShare = { userId: string; ratio: number; amount: number };

export type SplitResult = {
  total: number;
  charges: SplitShare[];
  /**
   * Σ tiền từng người − tổng chi. Luôn 0: tiền chia chính xác tới đồng nên thu đúng bằng chi.
   *
   * Vẫn giữ trường này vì bảng đã chốt từ TRƯỚC (thời còn làm tròn lên nghìn) có dư thật, và
   * `readSettlement` tính lại từ dữ liệu đã lưu chứ không chia lại.
   */
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
 * Input: danh sách người tham gia, danh sách dòng chi phí (ĐƠN GIÁ), hệ số nam.
 * Output: Tổng chi, số tiền từng người CHÍNH XÁC tới đồng, và phần dư (nay luôn 0).
 *
 *         Công thức: tổng chia cho tổng "suất", mỗi người trả số suất của mình.
 *         Nữ 1 suất, nam `maleRatio` suất. Hệ số 1.2 nghĩa là nam đóng gấp 1.2 lần nữ.
 *
 *         KHÔNG làm tròn lên nghìn nữa — tiền để lẻ tới đồng. 490.000đ chia cho 2 nam 2 nữ hệ
 *         số 1.2 ra 133.636đ và 111.364đ, chứ không phải 134.000đ và 112.000đ. Đổi lại: không
 *         còn khoản dư nào chảy vào quỹ mà chẳng ai nhớ mình đã đóng, thu đúng bằng chi.
 *
 *         Phần lẻ không chia hết đi theo LARGEST REMAINDER: mỗi người nhận phần nguyên của
 *         mình trước, thừa bao nhiêu đồng thì phát 1đ cho những người có phần dư lớn nhất. Nhờ
 *         vậy Σ tiền từng người bằng ĐÚNG tổng chi, không lệch một đồng, mà hai người cùng suất
 *         chênh nhau nhiều nhất 1đ. Chia đều phần lẻ cho vài người thay vì dồn hết vào một
 *         người: 1đ thì không ai thấy, nhưng "vì sao mình phải trả nhiều hơn" thì ai cũng hỏi.
 *
 *         TOÀN BỘ phép tính chạy trên SỐ NGUYÊN: hệ số nhân 100 lên (Decimal(4,2) ở DB nên
 *         không mất gì), rồi chia lấy phần nguyên và phần dư. Nếu tính bằng số thực thì cùng
 *         một trận, tính lại hai lần có thể ra hai kết quả lệch nhau — và đó đúng là con số
 *         người dùng sẽ đem ra so với nhau.
 *
 *         Trả `charges` rỗng khi không có người. Chưa có khoản chi nào thì mọi người là 0đ chứ
 *         không phải không có dòng nào: màn chốt chi phí hiện luôn bảng chia ngay khi mở, ai
 *         cũng thấy tên mình với số 0. Người gọi quyết định đó có phải lỗi hay không (chốt chi
 *         phí thì có, xem preview thì không).
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

  // Phần nguyên trước, phần dư giữ lại để xếp hạng xem ai được thêm 1đ.
  const shares = scaled.map((item, index) => {
    const exact = total * item.units;
    return {
      index,
      userId: item.userId,
      ratio: item.ratio,
      amount: Math.floor(exact / totalUnits),
      remainder: exact % totalUnits,
    };
  });

  // Σ phần dư luôn chia hết cho `totalUnits`, nên `leftover` là số nguyên trong [0, số người −
  // 1]: luôn đủ người để phát, không bao giờ chạy quá mảng.
  const leftover = total - shares.reduce((sum, share) => sum + share.amount, 0);
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (let i = 0; i < leftover; i += 1) byRemainder[i].amount += 1;

  const charges = shares.map((share) => ({
    userId: share.userId,
    ratio: share.ratio,
    amount: share.amount,
  }));

  // Tính lại thay vì trả thẳng 0: nếu một ngày cách chia đổi mà quên chỗ này, con số sẽ tự tố
  // giác chứ không im lặng nói dối.
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
