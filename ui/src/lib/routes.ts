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

/** Sổ lịch sử của cả tổ chức. Chỉ owner mở được — chính trang đó tự đá member về trang chủ. */
export function organizationHistoryPath(organizationId: string): string {
  return `/orgs/${organizationId}/org-history`
}

/**
 * Chi tiết một trận — nơi duy nhất chốt được giá.
 *
 * Nằm DƯỚI `/org-history` chứ không còn ở `/matches/<id>` riêng: sổ tổ chức là lối vào duy
 * nhất của trang này, nên đặt nó thành trang con làm hai việc cùng lúc — sidebar giữ nguyên
 * mục "Lịch sử tổ chức" đang sáng khi mở một trận, và breadcrumb có sẵn mẩu cha để quay lại.
 * Đoạn `matches` cũ chỉ là một mẩu URL không dẫn tới trang nào.
 */
export function matchDetailPath(organizationId: string, matchId: string): string {
  return `/orgs/${organizationId}/org-history/${matchId}`
}
