/** Một khoản nợ còn thiếu, đã sắp theo thứ tự ưu tiên trả. */
export type OutstandingDebt = {
  settlementId: string;
  remaining: number;
};

/** Một dòng phân bổ tiền vào đúng một khoản nợ. */
export type AllocationPlan = {
  settlementId: string;
  amount: number;
};

/**
 * Input: Tổng tiền cần chia và số người chịu.
 * Output: Mảng số tiền mỗi người, độ dài đúng bằng `count`.
 *
 * Largest remainder: `base = floor(total / n)`, phần dư `r = total % n` được rải mỗi người
 * một đồng cho `r` người đầu tiên. Bất biến: SUM(kết quả) === total tuyệt đối — không làm
 * tròn nghìn, không để dư đồng nào rơi vãi.
 *
 * Thứ tự đầu vào quyết định ai chịu thêm 1 đồng, nên caller phải sắp xếp tất định trước
 * (finalize sắp theo `attendances.created_at` rồi `user_id`).
 */
export function splitAmountLargestRemainder(total: number, count: number): number[] {
  if (count <= 0) return [];

  const base = Math.floor(total / count);
  const remainder = total % count;

  return Array.from({ length: count }, (_value, index) => (index < remainder ? base + 1 : base));
}

/**
 * Input: Số tiền của payment và danh sách nợ còn thiếu (đã sắp nợ cũ trước).
 * Output: Kế hoạch phân bổ — đổ đầy từng khoản theo thứ tự tới khi hết tiền.
 *
 * Tiền thừa sau khi trả hết nợ KHÔNG được phân bổ; caller phải từ chối payment đó
 * (PAY_003) chứ không tự giữ tiền treo lơ lửng.
 */
export function planAutoAllocations(paymentAmount: number, debts: OutstandingDebt[]): AllocationPlan[] {
  const plans: AllocationPlan[] = [];
  let left = paymentAmount;

  for (const debt of debts) {
    if (left <= 0) break;
    if (debt.remaining <= 0) continue;

    const amount = Math.min(left, debt.remaining);
    plans.push({ settlementId: debt.settlementId, amount });
    left -= amount;
  }

  return plans;
}
