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
