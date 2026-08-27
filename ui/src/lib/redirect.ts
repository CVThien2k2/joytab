/**
 * Input: Giá trị `next` đọc từ query (do proxy gắn vào khi chặn một trang cần quyền).
 * Output: true nếu đây là đường dẫn nội bộ an toàn để điều hướng tới.
 *
 * Cùng luật với BE (api/src/auth/auth.utils.ts → sanitizeReturnToPath) và với hub
 * (packages/contracts → isSafeInternalPath): phải bắt đầu bằng ĐÚNG MỘT dấu `/`, không
 * `//host`, không chứa `://` và không có `\` — cả ba dạng đó đều bị browser hiểu là địa chỉ
 * ngoài, tức là một open-redirect.
 *
 * Joytab không có package dùng chung giữa api và ui nên luật này buộc phải chép hai bản.
 * Bản BE là bản chốt: giá trị còn đi vòng qua Google rồi mới quay lại, và BE lọc lần cuối
 * trước khi redirect. Bản này chỉ để URL trên thanh địa chỉ không bao giờ mang địa chỉ lạ.
 */
export function isSafeInternalPath(path: string | null | undefined): path is string {
  return (
    typeof path === "string" &&
    path.startsWith("/") &&
    !path.startsWith("//") &&
    !path.includes("://") &&
    !path.includes("\\")
  )
}
