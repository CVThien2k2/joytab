/**
 * Màu suy từ một chuỗi: màu avatar theo tên người, màu nhãn theo mã trạng thái. Chép từ hub
 * (apps/hub-ui/lib/color.ts), kể cả cách băm — nhờ vậy cùng một người trong hai app rơi vào
 * cùng một màu, nhìn là nhận ra nhau.
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
 * Bảng class cho nhãn TRẠNG THÁI (nhãn giai đoạn trên chip lịch, và mọi nhãn theo mã sau này).
 *
 * Nền ĐẶC + chữ trắng chứ không phải tint nhạt như ROLE_PALETTE của hub: nhãn này nằm trên một
 * chip đã tô màu sẵn, một lớp 15% trên đó thì chìm hẳn.
 *
 * Cố tình KHÔNG có amber/yellow: đó là màu của chính chip, nhãn cùng hệ màu với nền nó đứng
 * trên thì bằng không có nhãn. Mọi màu trong bảng đều đủ tối để chữ trắng đọc được — thêm màu
 * mới phải kiểm lại điều kiện này.
 */
export const STATUS_PALETTE = [
  "bg-emerald-600 text-white",
  "bg-rose-600 text-white",
  "bg-sky-600 text-white",
  "bg-violet-600 text-white",
  "bg-teal-600 text-white",
  "bg-indigo-600 text-white",
] as const

/**
 * Input: Mã trạng thái (vd 'ongoing').
 * Output: Class màu cố định theo mã đó — cùng mã thì mãi cùng màu.
 *
 *         Suy từ mã chứ không gán tay từng cái: thêm một trạng thái mới là có màu ngay, và
 *         không ai phải nhớ màu nào đã dùng rồi. Đổi lại là không chọn được "đỏ cho cái này" —
 *         nếu một trạng thái cần đúng một màu theo quy ước thì gán riêng ở chỗ dùng.
 */
export function statusClass(code: string): string {
  return pickByHash(STATUS_PALETTE, code)
}

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
