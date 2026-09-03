/**
 * Khoảng ngày đang xem trên trang lịch thi đấu.
 *
 * Trang giữ MỘT mốc neo + MỘT kiểu xem, mọi thứ khác suy ra từ đó: khoảng gửi lên BE, tiêu đề
 * trên thanh công cụ, và phạm vi của cả bộ lịch lẫn danh sách. Trước đây khoảng ngày do chính
 * FullCalendar báo ra, nhưng ở chế độ danh sách thì không có bộ lịch nào để hỏi — mà hai nguồn
 * cho cùng một câu hỏi thì sẽ có lúc lệch nhau.
 */

/** Ba kiểu xem, trùng tên view của FullCalendar để truyền thẳng xuống. */
export const CALENDAR_VIEWS = [
  { type: "timeGridDay", label: "Ngày" },
  { type: "timeGridWeek", label: "Tuần" },
  { type: "dayGridMonth", label: "Tháng" },
] as const

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number]["type"]

/**
 * Nhãn điều hướng theo kiểu xem: một nút "lùi/tiến" nói đúng tên kỳ nó nhảy qua thì người
 * dùng không phải tự suy ra đang lùi một ngày hay một tháng. Nhãn "về kỳ hiện tại" cũng đổi
 * theo, vì "Hôm nay" ở lịch tháng là một lời hứa sai — bấm vào đó ra cả tháng.
 */
export const CALENDAR_NAV_LABELS = {
  timeGridDay: { prev: "Ngày trước", next: "Ngày sau", current: "Hôm nay" },
  timeGridWeek: { prev: "Tuần trước", next: "Tuần sau", current: "Tuần này" },
  dayGridMonth: { prev: "Tháng trước", next: "Tháng sau", current: "Tháng này" },
} satisfies Record<CalendarViewName, { prev: string; next: string; current: string }>

/** Khoảng ngày dạng ISO — gửi thẳng lên BE. */
export type CalendarRange = { from: string; to: string }

const DAY_MS = 86_400_000

function startOfDay(date: Date): Date {
  const result = new Date(date)
  result.setHours(0, 0, 0, 0)
  return result
}

/** Thứ 2 của tuần chứa `date`. Tuần bắt đầu thứ 2 vì `firstDay={1}` ở bộ lịch. */
function startOfWeek(date: Date): Date {
  const result = startOfDay(date)
  // getDay(): 0 = CN. Đưa về 0 = T2 rồi lùi lại bấy nhiêu ngày.
  result.setDate(result.getDate() - ((result.getDay() + 6) % 7))
  return result
}

/**
 * Input: mốc neo + kiểu xem.
 * Output: Khoảng [from, to) đúng bằng thứ màn hình đang hiển thị.
 *
 *         Tháng KHÔNG phải mùng 1 đến hết tháng, mà là trọn LƯỚI 6 TUẦN mà lịch tháng vẽ ra —
 *         `fixedWeekCount` của FullCalendar mặc định bật, nên lưới luôn có đúng 42 ô bắt đầu
 *         từ thứ 2 rơi vào hoặc trước mùng 1. Lấy đúng tháng thì mấy ô đầu tháng sau vẫn hiện
 *         trên lưới nhưng trận trong đó không được tải về, và ô trông như đang trống.
 */
export function rangeOf(anchor: Date, view: CalendarViewName): CalendarRange {
  if (view === "timeGridDay") {
    const from = startOfDay(anchor)
    return { from: from.toISOString(), to: new Date(from.getTime() + DAY_MS).toISOString() }
  }

  if (view === "timeGridWeek") {
    const from = startOfWeek(anchor)
    return { from: from.toISOString(), to: new Date(from.getTime() + 7 * DAY_MS).toISOString() }
  }

  const firstOfMonth = startOfDay(anchor)
  firstOfMonth.setDate(1)
  const from = startOfWeek(firstOfMonth)
  const to = new Date(from)
  to.setDate(to.getDate() + 42)
  return { from: from.toISOString(), to: to.toISOString() }
}

/**
 * Input: mốc neo + kiểu xem + hướng (-1 lùi, +1 tiến).
 * Output: Mốc neo của kỳ kế tiếp.
 *
 *         Tháng nhảy bằng `setMonth` trên NGÀY 1 chứ không cộng 30 ngày: cộng ngày thì từ 31/1
 *         lùi một tháng ra 1/1, và tháng 2 thì trôi hẳn.
 */
export function shiftAnchor(anchor: Date, view: CalendarViewName, direction: 1 | -1): Date {
  if (view === "timeGridDay") return new Date(anchor.getTime() + direction * DAY_MS)
  if (view === "timeGridWeek") return new Date(anchor.getTime() + direction * 7 * DAY_MS)

  const result = startOfDay(anchor)
  result.setDate(1)
  result.setMonth(result.getMonth() + direction)
  return result
}

const dayTitleFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
})

const weekTitleFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "numeric",
  month: "long",
  year: "numeric",
})

const monthTitleFormatter = new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric" })

/**
 * Input: mốc neo + kiểu xem.
 * Output: Tiêu đề kỳ đang xem, vd "24 – 30 tháng 8, 2026".
 *
 *         Tự dựng bằng Intl chứ không đọc `view.title` của thư viện, vì chế độ danh sách không
 *         có bộ lịch nào để hỏi. `formatRange` cũng chính là thứ FullCalendar v7 dùng bên
 *         trong, nên hai bên ra cùng một chuỗi.
 */
/**
 * Input: mốc neo + kiểu xem + mốc "bây giờ".
 * Output: Kỳ đang xem có phải kỳ chứa hôm nay.
 *
 *         So bằng ĐIỂM BẮT ĐẦU của khoảng chứ không so từng ngày: khoảng là thứ đã chuẩn hoá
 *         sẵn cho cả ba kiểu xem (ngày / tuần từ thứ 2 / lưới 6 tuần), nên không phải viết lại
 *         luật biên kỳ ở đây lần thứ hai.
 */
export function isCurrentPeriod(anchor: Date, view: CalendarViewName, now: number): boolean {
  return rangeOf(anchor, view).from === rangeOf(new Date(now), view).from
}

export function rangeTitle(anchor: Date, view: CalendarViewName): string {
  if (view === "timeGridDay") return dayTitleFormatter.format(anchor)
  if (view === "dayGridMonth") return monthTitleFormatter.format(anchor)

  const from = startOfWeek(anchor)
  const to = new Date(from.getTime() + 6 * DAY_MS)
  return weekTitleFormatter.formatRange(from, to)
}
