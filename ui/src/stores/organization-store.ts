import { createStore } from "zustand/vanilla"
import type { Organization } from "@/types/organization"

export type OrganizationState = {
  /** Mọi tổ chức user thuộc, cũ nhất trước (thứ tự do BE bảo đảm). */
  organizations: Organization[]
  /** id tổ chức đang xem — luôn lấy từ URL, không phải từ cookie. */
  activeOrganizationId: string
}

export type OrganizationActions = {
  setSnapshot: (state: OrganizationState) => void
}

export type OrganizationStore = OrganizationState & OrganizationActions

export const defaultOrganizationState: OrganizationState = {
  organizations: [],
  activeOrganizationId: "",
}

/**
 * Input: State khởi tạo (do layout `/orgs/[orgId]` fetch từ BE rồi truyền xuống).
 * Output: Một store MỚI mỗi lần gọi — factory chứ không phải store toàn cục, cùng lý do đã
 *         ghi ở auth-store: biến module-scope trên server bị chia sẻ giữa các request đồng
 *         thời nên user này đọc thấy danh sách tổ chức của user khác.
 *
 *         Chỉ có đúng một action `setSnapshot`: dữ liệu ở đây luôn đến từ server component,
 *         client không tự sửa từng phần. Đổi tổ chức, tạo, tham gia đều kết thúc bằng một
 *         lượt render mới của layout — provider bơm nguyên khối mới vào.
 */
export const createOrganizationStore = (initState: OrganizationState = defaultOrganizationState) =>
  createStore<OrganizationStore>()((set) => ({
    ...initState,
    setSnapshot: (state) => set(state),
  }))
