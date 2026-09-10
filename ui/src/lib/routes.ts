/**
 * Input: id tổ chức.
 * Output: Trang chủ của tổ chức — nơi có bốn con số và danh sách buổi sắp tới.
 *
 * Khai một chỗ vì có ba lối vào dùng chung nó (ngã ba `/`, nút chuyển tổ chức ở sidebar, và cú
 * đá member ra khỏi trang cấu hình): ba chỗ tự viết đường dẫn là ba chỗ sẽ lệch nhau khi đổi
 * trang mặc định.
 *
 * Đúng bằng gốc `/orgs/<id>`, nhưng vẫn giữ hàm chứ không viết thẳng: nó từng là `/matches` và
 * có thể đổi lần nữa.
 */
export function organizationHomePath(organizationId: string): string {
  return `/orgs/${organizationId}`
}

/** Trang cấu hình tổ chức. Chỉ owner mở được — chính trang đó tự đá member về trang chủ. */
export function organizationSettingsPath(organizationId: string): string {
  return `/orgs/${organizationId}/settings`
}
