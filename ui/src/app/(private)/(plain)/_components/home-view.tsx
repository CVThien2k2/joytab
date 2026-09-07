"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { OrganizationEmptyState } from "@/app/(private)/_components/organization-empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizations } from "@/hooks/use-organizations-api"
import { organizationHomePath } from "@/lib/routes"

/**
 * Input: Không nhận props.
 * Output: Ngã ba của lối vào app:
 *  - Chưa thuộc tổ chức nào → hai nút tham gia bằng mã / tạo tổ chức.
 *  - Đã có tổ chức → đá sang `/orgs/<id>/matches`.
 *
 *         Đích là tổ chức xem lần gần nhất (`activeOrganizationId`, do BE đọc từ cookie `org`
 *         và đã đối chiếu với danh sách thật), không có thì lấy phần tử đầu — BE sắp theo
 *         `joined_at` tăng dần nên "đầu" là tổ chức lâu nhất, ổn định giữa các lần vào.
 *
 *         `replace` chứ không `push`: `/` chỉ là ngã ba, để lại trong history thì bấm Back từ
 *         tổ chức sẽ rơi vào đây rồi bị đá ngược lại đúng chỗ vừa rời.
 *
 *         Điều hướng trong effect, không phải lúc render: đổi route ngay trong thân component
 *         là ghi state của router trong lúc React đang render cây khác.
 */
export function HomeView() {
  const router = useRouter()
  const { data } = useOrganizations()

  const target = data?.activeOrganizationId ?? data?.organizations[0]?.id ?? null

  useEffect(() => {
    if (target) router.replace(organizationHomePath(target))
  }, [router, target])

  // Bất khả trong luồng thật (SessionGate đã chờ query xong), nhưng type thì vẫn là optional.
  if (!data) return null

  if (data.organizations.length === 0) return <OrganizationEmptyState />

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm">Đang mở tổ chức của bạn</p>
      </div>
    </main>
  )
}
