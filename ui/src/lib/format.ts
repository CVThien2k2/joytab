/**
 * Khai một lần rồi dùng lại: khởi tạo Intl.DateTimeFormat tốn kém hơn hẳn việc gọi format,
 * mà danh sách thành viên gọi nó một lần trên mỗi dòng.
 */
const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
})

/**
 * Input: Chuỗi ISO 8601 do BE trả về (vd joinedAt).
 * Output: Ngày theo lối viết Việt Nam: 27/08/2026.
 *
 *         Chốt locale "vi-VN" chứ không để Intl tự đoán theo máy: server render ra một chuỗi,
 *         browser render ra chuỗi khác thì React báo lệch hydrate. App chỉ có tiếng Việt nên
 *         chốt cứng là đúng, không phải giới hạn.
 */
export function formatDate(isoString: string): string {
  return dateFormatter.format(new Date(isoString))
}

/** Tiền Việt: 150.000 — không kèm "₫" vì chỗ dùng tự thêm đơn vị theo ngữ cảnh. */
const moneyFormatter = new Intl.NumberFormat("vi-VN")

/**
 * Input: Số tiền, đơn vị đồng (BE luôn trả số nguyên).
 * Output: "150.000". Không làm tròn, không rút gọn thành "150k": đây là số người ta đem đi
 *         chuyển khoản, sai một chữ số là sai tiền.
 */
export function formatMoney(amount: number): string {
  return moneyFormatter.format(amount)
}

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
})

/** "19:00" — dùng cho chip trên lịch, nơi chỉ có chỗ cho giờ. */
export function formatTime(isoString: string): string {
  return timeFormatter.format(new Date(isoString))
}

/** "19:00 - 21:00" */
export function formatTimeRange(startIso: string, endIso: string): string {
  return `${formatTime(startIso)} - ${formatTime(endIso)}`
}

/** "T5, 28/08 19:00" — đủ để nhận ra buổi nào mà không dài như ngày đầy đủ. */
export function formatDateTime(isoString: string): string {
  return dateTimeFormatter.format(new Date(isoString))
}
