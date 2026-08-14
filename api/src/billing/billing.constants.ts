/** Nguồn sự thật cho các hằng số của module billing. */

/** Trần số tiền một lần thanh toán (VND). Giữ cách xa trần Int 2.147 tỷ của Postgres. */
export const MAX_PAYMENT_AMOUNT = 1_000_000_000;

/** Trần số dòng phân bổ trong một payment. */
export const MAX_ALLOCATIONS_PER_PAYMENT = 100;

/**
 * Trạng thái nợ — dữ liệu DẪN XUẤT, không có cột nào lưu nó. Tính lúc đọc từ
 * `amount` và `paid_amount`.
 */
export const DEBT_STATUS = {
  UNPAID: 'UNPAID',
  PARTIAL: 'PARTIAL',
  PAID: 'PAID',
} as const;

export type DebtStatus = (typeof DEBT_STATUS)[keyof typeof DEBT_STATUS];

/**
 * Input: Số tiền phải trả và số đã trả của một khoản nợ.
 * Output: UNPAID / PARTIAL / PAID.
 */
export function resolveDebtStatus(amount: number, paidAmount: number): DebtStatus {
  if (paidAmount <= 0) return DEBT_STATUS.UNPAID;
  if (paidAmount < amount) return DEBT_STATUS.PARTIAL;

  return DEBT_STATUS.PAID;
}
