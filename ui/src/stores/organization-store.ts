import { create } from "zustand"
import type { Organization } from "@/types/organization"

export type OrganizationSnapshot = {
  /** Mọi tổ chức user thuộc, cũ nhất trước (thứ tự do BE bảo đảm). */
  organizations: Organization[]
  /** id tổ chức đang xem, lấy từ URL `/orgs/[orgId]`. */
  activeOrganizationId: string
}

export type OrganizationStore = OrganizationSnapshot & {
  setSnapshot: (snapshot: OrganizationSnapshot) => void
}

/**
 * Store toàn cục, cùng lý do đã ghi ở auth-store: không còn server component nào ghi vào đây
 * nên không cần factory + context nữa. Dữ liệu đến từ query /organizations (chạy trên browser),
 * còn "đang xem tổ chức nào" thì do layout quyết định rồi bơm vào bằng `setSnapshot`.
 *
 * Chỉ có đúng một action: dữ liệu ở đây luôn là một khối nguyên đến từ query, client không tự
 * sửa từng phần. Tạo/tham gia/rời tổ chức đều kết thúc bằng một lượt invalidate query.
 */
export const useOrganizationStore = create<OrganizationStore>()((set) => ({
  organizations: [],
  activeOrganizationId: "",
  setSnapshot: (snapshot) => set(snapshot),
}))

/**
 * Input: Không nhận tham số.
 * Output: Tổ chức đang xem. Không tìm thấy là bất khả: layout đã `notFound()` khi `orgId` trên
 *         URL không thuộc danh sách, và chỉ render children sau khi store đã được bơm.
 */
export function useActiveOrganization(): Organization {
  return useOrganizationStore((state) => {
    const active = state.organizations.find(
      (organization) => organization.id === state.activeOrganizationId,
    )
    if (!active) throw new Error("Tổ chức đang xem không có trong danh sách")
    return active
  })
}
