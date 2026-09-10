/**
 * Màu avatar suy từ tên người. Chép từ hub (apps/hub-ui/lib/color.ts), kể cả cách băm — nhờ vậy
 * cùng một người trong hai app rơi vào cùng một màu, nhìn là nhận ra nhau.
 *
 * Từng có thêm một bảng màu băm cho nhãn trạng thái, giờ bỏ: ba giai đoạn của một trận có thứ
 * tự và có nghĩa, nên màu của chúng phải gán tay cho đúng nghĩa
 * chứ không phải "băm ra ba màu khác nhau là được".
 */

/**
 * Input: Mảng lựa chọn + chuỗi khoá.
 * Output: Một phần tử, CỐ ĐỊNH theo khoá — cùng tên thì mãi cùng màu, kể cả sau khi reload hay
 *         đổi máy. Không dùng random vì màu avatar đổi mỗi lần render thì mất luôn tác dụng
 *         "nhận ra người quen bằng màu".
 */
export function pickByHash<T>(items: readonly T[], key: string | null | undefined): T {
  const source = key ?? ""
  let hash = 0
  for (let index = 0; index < source.length; index += 1) {
    hash = (hash * 31 + source.charCodeAt(index)) >>> 0
  }
  return items[hash % items.length]
}

/**
 * Bảng màu nền của avatar. Cùng bộ với hub, và mọi màu đều đủ tối để chữ TRẮNG đọc được trên
 * đó — thêm màu mới thì phải kiểm lại điều kiện này.
 */
export const AVATAR_PALETTE = [
  "#203558",
  "#0891b2",
  "#7c3aed",
  "#db2777",
  "#ea580c",
  "#16a34a",
  "#0d9488",
  "#4f46e5",
  "#b91c1c",
  "#9333ea",
] as const

/**
 * Input: Tên (hoặc email khi chưa có tên).
 * Output: Màu nền ổn định cho avatar của người đó.
 */
export function colorFromName(name: string | null | undefined): string {
  return pickByHash(AVATAR_PALETTE, name)
}

/**
 * Input: Tên hoặc email.
 * Output: 1–2 ký tự viết tắt — chữ đầu của từ đầu và từ cuối.
 *
 *         Là chỗ DUY NHẤT tính chữ viết tắt trong app: trước đây bốn component tự tính, bốn bản
 *         copy là bốn chỗ có thể trôi ra khác nhau cho cùng một người.
 */
export function initialsFromName(name: string | null | undefined): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
