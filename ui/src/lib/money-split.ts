/**
 * Input: Tổng tiền cần chia và số người chịu.
 * Output: Số tiền mỗi người, tổng luôn khớp `total` tuyệt đối.
 *
 * Bản sao đúng thuật toán largest-remainder của BE (`splitAmountLargestRemainder`), chỉ để
 * XEM TRƯỚC trên màn finalize. Con số chính thức luôn do BE tính lại trong transaction —
 * FE không bao giờ gửi kết quả chia lên.
 */
export function previewSplit(total: number, count: number): number[] {
  if (count <= 0) return []

  const base = Math.floor(total / count)
  const remainder = total % count

  return Array.from({ length: count }, (_value, index) =>
    index < remainder ? base + 1 : base,
  )
}
