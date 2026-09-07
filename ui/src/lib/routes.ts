/**
 * Input: id tổ chức.
 * Output: Trang mặc định khi vào một tổ chức — lịch thi đấu.
 *
 * Khai một chỗ vì có hai lối vào dùng chung nó (ngã ba `/` và nút chuyển tổ chức ở sidebar):
 * hai chỗ tự viết `/orgs/${id}/matches` là hai chỗ sẽ lệch nhau khi đổi trang mặc định.
 *
 * Lịch là thứ người ta mở hàng ngày, còn trang thông tin tổ chức thì vài tháng mới sửa một lần.
 */
export function organizationHomePath(organizationId: string): string {
  return `/orgs/${organizationId}/matches`
}
