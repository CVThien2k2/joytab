/** Người tham gia ở mức tối thiểu cần cho việc chia tiền. */
export type SplitParticipant = { userId: string; gender: "male" | "female" | "other" | null }

/** Một dòng chi phí: ĐƠN GIÁ, không phải thành tiền. */
export type SplitExpense = { quantity: number; unitPrice: number }

export type SplitShare = { userId: string; ratio: number; amount: number }

export type SplitResult = {
  total: number
  charges: SplitShare[]
  /** Σ tiền từng người − tổng chi. Luôn 0: chia chính xác tới đồng nên thu đúng bằng chi. */
  surplus: number
}

/**
 * Input: giới tính + hệ số nam.
 * Output: Hệ số áp cho người đó. Nữ là mốc 1; 'other' và chưa khai tính như nam.
 */
export function ratioFor(gender: SplitParticipant["gender"], maleRatio: number): number {
  return gender === "female" ? 1 : maleRatio
}

/**
 * Input: người tham gia, các dòng chi phí, hệ số nam.
 * Output: Tổng chi, tiền từng người CHÍNH XÁC tới đồng, phần dư (luôn 0).
 *
 *         Bản sao ĐÚNG NGUYÊN của công thức ở BE (api/src/matches/matches.utils.ts) — mọi lý
 *         do vì sao chia thế này nằm ở đó. Có ở FE để màn chốt chi phí hiện kết quả ngay khi
 *         gõ, chứ không phải để quyết định: con số thật luôn là con số BE tính lại lúc xác nhận.
 *
 *         Cũng vì vậy phép tính phải chạy trên SỐ NGUYÊN y hệt BE — hệ số nhân 100, chia lấy
 *         phần nguyên, rồi phát phần lẻ theo largest remainder. Nếu FE tính bằng số thực thì
 *         preview và kết quả lưu có thể lệch nhau, và đó đúng là con số người dùng đem ra so.
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

  const shares = scaled.map((item, index) => {
    const exact = total * item.units
    return {
      index,
      userId: item.userId,
      ratio: item.ratio,
      amount: Math.floor(exact / totalUnits),
      remainder: exact % totalUnits,
    }
  })

  const leftover = total - shares.reduce((sum, share) => sum + share.amount, 0)
  const byRemainder = [...shares].sort((a, b) => b.remainder - a.remainder || a.index - b.index)
  for (let i = 0; i < leftover; i += 1) byRemainder[i].amount += 1

  const charges = shares.map((share) => ({
    userId: share.userId,
    ratio: share.ratio,
    amount: share.amount,
  }))

  const collected = charges.reduce((sum, charge) => sum + charge.amount, 0)
  return { total, charges, surplus: collected - total }
}
