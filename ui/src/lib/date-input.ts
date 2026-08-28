/**
 * Chuyển đổi giữa `Date` và cặp ô `<input type="date">` + `<input type="time">`.
 *
 * Tách ra khỏi format.ts vì hai việc khác nhau: format.ts sinh chữ cho NGƯỜI đọc (locale
 * vi-VN, có thể đổi cách viết bất cứ lúc nào), còn ở đây là định dạng MÁY đọc mà thẻ input
 * bắt buộc phải nhận — đổi một chữ là ô trống trơn.
 */

/** "2026-08-28" theo giờ máy người dùng — `toISOString` sẽ ra ngày hôm trước ở múi giờ âm. */
export function toDateInput(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

/** "19:00" theo giờ máy. */
export function toTimeInput(date: Date): string {
  return `${`${date.getHours()}`.padStart(2, "0")}:${`${date.getMinutes()}`.padStart(2, "0")}`
}

/**
 * Input: ngày (yyyy-mm-dd) + giờ (HH:mm) theo giờ máy.
 * Output: Chuỗi ISO có offset để gửi BE.
 *
 *         Ghép rồi để `new Date` hiểu theo GIỜ MÁY: người tạo lịch gõ "19:00" là 19h ở sân,
 *         không phải 19h UTC.
 */
export function toIso(date: string, time: string): string {
  return new Date(`${date}T${time}:00`).toISOString()
}
