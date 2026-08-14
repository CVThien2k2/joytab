/** Múi giờ nghiệp vụ cố định, khớp hằng số phía BE. */
const VN_TIME_ZONE = "Asia/Ho_Chi_Minh"

const moneyFormatter = new Intl.NumberFormat("vi-VN")

const dateTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
})

const dateFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

const timeFormatter = new Intl.DateTimeFormat("vi-VN", {
  timeZone: VN_TIME_ZONE,
  hour: "2-digit",
  minute: "2-digit",
})

/** Tên thứ theo ISO-8601 — 1 = thứ Hai … 7 = Chủ nhật, khớp `event_templates.day_of_week`. */
export const DAY_OF_WEEK_LABELS: Record<number, string> = {
  1: "Thứ 2",
  2: "Thứ 3",
  3: "Thứ 4",
  4: "Thứ 5",
  5: "Thứ 6",
  6: "Thứ 7",
  7: "Chủ nhật",
}

/**
 * Input: Số tiền VND.
 * Output: Chuỗi kèm đơn vị, vd `120.000 ₫`.
 */
export function formatMoney(amount: number): string {
  return `${moneyFormatter.format(amount)} ₫`
}

/**
 * Input: Thời điểm bất kỳ.
 * Output: `dd/MM/yyyy HH:mm` theo giờ VN.
 */
export function formatDateTime(value: Date): string {
  return dateTimeFormatter.format(value)
}

/**
 * Input: Thời điểm bất kỳ.
 * Output: `Th 5, 20/08` theo giờ VN — dùng cho danh sách trận.
 */
export function formatDate(value: Date): string {
  return dateFormatter.format(value)
}

/**
 * Input: Thời điểm bất kỳ.
 * Output: `HH:mm` theo giờ VN.
 */
export function formatTime(value: Date): string {
  return timeFormatter.format(value)
}

/**
 * Input: Khoảng thời gian của một buổi đánh.
 * Output: `Th 5, 20/08 · 19:00–21:00`.
 */
export function formatEventRange(startAt: Date, endAt: Date): string {
  return `${formatDate(startAt)} · ${formatTime(startAt)}–${formatTime(endAt)}`
}

/**
 * Input: Giờ dạng `HH:mm:ss` từ BE.
 * Output: `HH:mm` để hiển thị.
 */
export function formatTimeOfDay(value: string): string {
  return value.slice(0, 5)
}

/**
 * Input: Thời điểm (UTC) cần đưa vào `<input type="datetime-local">`.
 * Output: Chuỗi `YYYY-MM-DDTHH:mm` đọc theo giờ VN — input này không có khái niệm múi giờ,
 *         nên phải tự dịch trước khi đưa vào, không thì lệch 7 tiếng.
 */
export function toVnDateTimeLocal(value: Date): string {
  const shifted = new Date(value.getTime() + 7 * 60 * 60 * 1000)
  return shifted.toISOString().slice(0, 16)
}

/**
 * Input: Chuỗi `YYYY-MM-DDTHH:mm` người dùng nhập, hiểu theo giờ VN.
 * Output: Chuỗi ISO có offset `+07:00` để gửi lên BE.
 */
export function fromVnDateTimeLocal(value: string): string {
  return `${value}:00+07:00`
}
