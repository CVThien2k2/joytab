/**
 * Khoảng ngày đang xem trên trang lịch thi đấu.
 *
 * Trang giữ MỘT mốc neo + MỘT kiểu xem, mọi thứ khác suy ra từ đó: khoảng gửi lên BE, tiêu đề
 * trên thanh công cụ, và phạm vi của cả bộ lịch lẫn danh sách. Trước đây khoảng ngày do chính
 * FullCalendar báo ra, nhưng ở chế độ danh sách thì không có bộ lịch nào để hỏi — mà hai nguồn
 * cho cùng một câu hỏi thì sẽ có lúc lệch nhau.
 */

/** Ba kiểu xem người dùng CHỌN được, trùng tên view của FullCalendar để truyền thẳng xuống. */
export const CALENDAR_VIEWS = [
  { type: "timeGridDay", label: "Ngày" },
  { type: "timeGridWeek", label: "Tuần" },
  { type: "dayGridMonth", label: "Tháng" },
] as const

export type CalendarViewName = (typeof CALENDAR_VIEWS)[number]["type"]

/**
 * Kỳ đang xem: một trong ba kiểu lịch, hoặc `"agenda"` — danh sách dọc trên mobile.
 *
 * `"agenda"` KHÔNG có trong `CALENDAR_VIEWS` vì nó không phải một lựa chọn: màn hẹp thì lịch
 * lưới không dùng được (7 cột trong ~300px là 36-43px một ngày — đo trên máy thật thì chữ trong
 * chip rớt xuống từng ký tự một dòng và chip tràn khỏi ô), nên ở đó danh sách là thứ DUY NHẤT
 * hiện ra. Đưa nó vào bộ chuyển là mời người ta bấm sang một kiểu xem đã vỡ.
 *
 * Vẫn nằm cùng kiểu với ba cái kia để `rangeOf` / `shiftAnchor` / `rangeTitle` dùng chung một
 * đường: agenda cũng là một kỳ có mốc neo, có khoảng, có tiêu đề — chỉ khác cách vẽ. Tách ra
 * thành bộ hàm riêng là bốn bản sao của cùng một luật biên kỳ.
 */
export type CalendarPeriod = CalendarViewName | "agenda"

/**
 * Nhãn điều hướng theo kiểu xem: một nút "lùi/tiến" nói đúng tên kỳ nó nhảy qua thì người
 * dùng không phải tự suy ra đang lùi một ngày hay một tháng. Nhãn "về kỳ hiện tại" cũng đổi
 * theo, vì "Hôm nay" ở lịch tháng là một lời hứa sai — bấm vào đó ra cả tháng.
 */
export const CALENDAR_NAV_LABELS = {
  timeGridDay: { prev: "Ngày trước", next: "Ngày sau", current: "Hôm nay" },
  timeGridWeek: { prev: "Tuần trước", next: "Tuần sau", current: "Tuần này" },
  dayGridMonth: { prev: "Tháng trước", next: "Tháng sau", current: "Tháng này" },
  agenda: { prev: "Tháng trước", next: "Tháng sau", current: "Tháng này" },
} satisfies Record<CalendarPeriod, { prev: string; next: string; current: string }>

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
export function rangeOf(anchor: Date, view: CalendarPeriod): CalendarRange {
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

  // Agenda liệt kê ĐÚNG tháng, không có lưới nào phải lấp đầy: lấy thêm ngày của tháng bên
  // cạnh là in ra những buổi mà tiêu đề "tháng 9" vừa nói là không thuộc về nó.
  if (view === "agenda") {
    const to = new Date(firstOfMonth)
    to.setMonth(to.getMonth() + 1)
    return { from: firstOfMonth.toISOString(), to: to.toISOString() }
  }

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
export function shiftAnchor(anchor: Date, view: CalendarPeriod, direction: 1 | -1): Date {
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
 * Bản NGẮN của tiêu đề, cho thanh công cụ trên mobile: "Thứ Bảy, 30 tháng 8, 2026" là 25 ký tự
 * trên một thanh chỉ còn ~110px cho tiêu đề, nên nó bị cắt đúng ở chỗ mang thông tin. Tháng thì
 * không có bản ngắn — "tháng 8, 2026" đã vừa.
 */
const shortDayTitleFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "short",
  day: "2-digit",
  month: "2-digit",
})

const shortWeekTitleFormatter = new Intl.DateTimeFormat("vi-VN", {
  day: "2-digit",
  month: "2-digit",
})

/** "thg 9, 2026" — đủ ngắn để tiêu đề, nút lật kỳ và nút tạo lịch nằm chung MỘT hàng ở 360px. */
const shortMonthTitleFormatter = new Intl.DateTimeFormat("vi-VN", {
  month: "short",
  year: "numeric",
})

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
export function isCurrentPeriod(anchor: Date, view: CalendarPeriod, now: number): boolean {
  return rangeOf(anchor, view).from === rangeOf(new Date(now), view).from
}

export function rangeTitle(anchor: Date, view: CalendarPeriod, short = false): string {
  if (view === "timeGridDay") {
    return (short ? shortDayTitleFormatter : dayTitleFormatter).format(anchor)
  }
  if (view === "dayGridMonth" || view === "agenda") {
    return (short ? shortMonthTitleFormatter : monthTitleFormatter).format(anchor)
  }

  const from = startOfWeek(anchor)
  const to = new Date(from.getTime() + 6 * DAY_MS)
  return (short ? shortWeekTitleFormatter : weekTitleFormatter).formatRange(from, to)
}
