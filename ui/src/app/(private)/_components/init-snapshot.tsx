"use client"

import { useAuthStore } from "@/providers/auth-store-provider"
import type { Organization } from "@/types/organization"

/**
 * Input: Danh sách tổ chức của user (đã sắp cũ nhất trước, do server component fetch).
 * Output: In nguyên trạng dữ liệu init ra màn hình. Cố tình chưa dựng UI nghiệp vụ gì —
 *         đây là chỗ để xem BE trả về đúng chưa.
 *
 *         "Tổ chức đang xem" tạm thời là phần tử ĐẦU danh sách: giai đoạn này chưa có bộ chọn
 *         tổ chức, và thứ tự do BE bảo đảm ổn định (joined_at tăng dần) nên chọn như vậy là
 *         xác định, không phải tuỳ tiện.
 */
export function InitSnapshot({ organizations }: { organizations: Organization[] }) {
  const user = useAuthStore((state) => state.user)
  const currentOrganization = organizations[0]

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <p className="text-sm">
        Tổ chức đang xem: <span className="font-semibold">{currentOrganization.name}</span>{" "}
        <span className="text-muted-foreground">
          ({currentOrganization.role === "owner" ? "chủ tổ chức" : "thành viên"} ·{" "}
          {currentOrganization.memberCount} thành viên)
        </span>
      </p>

      <pre className="mt-4 overflow-x-auto text-xs leading-relaxed">
        {JSON.stringify({ user, organizations }, null, 2)}
      </pre>
    </main>
  )
}
