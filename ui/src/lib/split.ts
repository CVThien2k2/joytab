import { MONEY_ROUNDING_UNIT } from "@/schema/match"

/** Người tham gia ở mức tối thiểu cần cho việc chia tiền. */
export type SplitParticipant = { userId: string; gender: "male" | "female" | "other" | null }

/** Một dòng chi phí: ĐƠN GIÁ, không phải thành tiền. */
export type SplitExpense = { quantity: number; unitPrice: number }

export type SplitShare = { userId: string; ratio: number; amount: number }

export type SplitResult = {
  total: number
  charges: SplitShare[]
  /** Σ tiền từng người − tổng chi. Luôn ≥ 0 vì mọi khoản đều làm tròn LÊN. */
  surplus: number
}

/**
 * Input: giới tính + hệ số nam.
 * Output: Hệ số áp cho người đó. Nữ là mốc 1; 'other' và chưa khai tính như nam.
 */
export function ratioFor(gender: SplitParticipant["gender"], maleRatio: number): number {
  return gender === "female" ? 1 : maleRatio
}

/** Chia làm tròn LÊN bằng số nguyên — xem chú thích trong splitExpenses. */
function ceilDiv(numerator: number, denominator: number): number {
  return Math.floor((numerator + denominator - 1) / denominator)
}

/**
 * Input: người tham gia, các dòng chi phí, hệ số nam.
 * Output: Tổng chi, tiền từng người (đã làm tròn lên nghìn), phần dư vào quỹ.
 *
 *         Bản sao ĐÚNG NGUYÊN của công thức ở BE (api/src/matches/matches.utils.ts). Có ở FE
 *         để màn chốt chi phí hiện kết quả ngay khi gõ, chứ không phải để quyết định: con số
 *         thật luôn là con số BE tính lại lúc xác nhận.
 *
 *         Cũng vì vậy phép tính phải chạy trên SỐ NGUYÊN y hệt BE — hệ số nhân 100 rồi chia
 *         nguyên có làm tròn lên. Nếu FE tính bằng số thực thì preview và kết quả lưu có thể
 *         lệch nhau 1.000đ, và đó đúng là con số người dùng đem ra so.
 */
export function splitExpenses(params: {
  participants: SplitParticipant[]
  expenses: SplitExpense[]
  maleRatio: number
}): SplitResult {
  const total = params.expenses.reduce(
    (sum, expense) => sum + expense.quantity * expense.unitPrice,
    0,
  )

  const scaled = params.participants.map((participant) => {
    const ratio = ratioFor(participant.gender, params.maleRatio)
    return { userId: participant.userId, ratio, units: Math.round(ratio * 100) }
  })
  const totalUnits = scaled.reduce((sum, item) => sum + item.units, 0)

  if (totalUnits === 0 || total <= 0) {
    return {
      total,
      charges: scaled.map((item) => ({ userId: item.userId, ratio: item.ratio, amount: 0 })),
      surplus: 0,
    }
  }

  const charges = scaled.map((item) => ({
    userId: item.userId,
    ratio: item.ratio,
    amount: ceilDiv(total * item.units, totalUnits * MONEY_ROUNDING_UNIT) * MONEY_ROUNDING_UNIT,
  }))

  const collected = charges.reduce((sum, charge) => sum + charge.amount, 0)
  return { total, charges, surplus: collected - total }
}
