import { Spinner } from "@/components/ui/spinner"

/**
 * Input: Không nhận tham số.
 * Output: Trạng thái chờ trong lúc page gọi /organizations/:id/members.
 *
 *         Cùng khuôn với loading của /onboarding: spinner + một dòng nói rõ đang chờ cái gì.
 *         Nằm trong khung có sidebar (layout của tổ chức đã render xong) nên chỉ vùng nội dung
 *         nhấp nháy, sidebar và nút chuyển tổ chức vẫn dùng được trong lúc chờ.
 */
export default function MembersLoading() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="flex flex-col items-center gap-4 text-center text-muted-foreground">
        <Spinner className="size-8 text-primary" />
        <p className="text-sm">Đang tải danh sách thành viên</p>
      </div>
    </main>
  )
}
