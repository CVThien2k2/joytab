"use client"

import { LogOut } from "lucide-react"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { useLeaveOrganization } from "@/hooks/use-organizations-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Tổ chức muốn rời + trạng thái mở của hộp thoại.
 * Output: Hộp thoại xác nhận rời tổ chức. Rời xong `useLeaveOrganization` tự đá về `/`.
 *
 *         Là component riêng vì có HAI chỗ mở nó: menu tài khoản ở sidebar (đường duy nhất của
 *         member, do họ không vào được trang Tổ chức nữa) và khối nguy hiểm cuối trang Tổ chức.
 *         Hai bản chép tay là hai câu cảnh báo sẽ trôi mỗi cái một kiểu.
 *
 *         Không tự dựng nút bấm: hai chỗ gọi có hình dạng khác hẳn nhau (một mục trong dropdown
 *         và một nút viền đỏ trong thẻ), nên nút thuộc về phía gọi, hộp thoại thuộc về đây.
 *
 *         Rời tổ chức KHÔNG bắt gõ lại tên như xoá tổ chức: bấm nhầm thì vào lại được bằng mã
 *         hoặc liên kết mời, không mất dữ liệu của ai.
 *
 *         showCloseButton tắt: nút X ở góc nằm ngay cạnh tiêu đề cảnh báo, dễ bấm nhầm thành
 *         "đồng ý". Đóng bằng nút Huỷ, Esc hoặc click ra ngoài — vẫn đủ ba đường ra.
 */
export function LeaveOrganizationDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: { id: string; name: string }
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const userId = useAuthStore((state) => state.user?.userId)
  const leave = useLeaveOrganization(organization, userId ?? "")

  /** Chặn đóng trong lúc đang gửi: đóng giữa chừng thì người dùng không biết mình đã rời chưa. */
  function handleOpenChange(next: boolean): void {
    if (leave.isPending) return
    onOpenChange(next)
  }

  // Không render khi chưa biết mình là ai: rời tổ chức cần userId, mà hiện một nút bấm vào là
  // lỗi thì tệ hơn là không hiện.
  if (!userId) return null

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {leave.isPending ? <LoadingOverlay label="Đang rời tổ chức" /> : null}

        <DialogHeader>
          {/* Icon trong ô tròn đặt trên tiêu đề: nhận ra "đây là hộp thoại phá huỷ" trước khi
              đọc chữ. Sắc trung tính chứ không đỏ như xoá tổ chức — rời đi không phải thảm hoạ. */}
          <div className="flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <LogOut className="size-5" aria-hidden="true" />
          </div>

          <DialogTitle className="mt-3">Rời &quot;{organization.name}&quot;?</DialogTitle>
          <DialogDescription>
            Bạn sẽ mất quyền truy cập ngay lập tức. Vào lại được nếu chủ tổ chức còn mở mã tham gia
            hoặc gửi bạn liên kết mời.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5">
          <Button
            type="button"
            variant="outline"
            disabled={leave.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={leave.isPending}
            onClick={() => leave.mutate()}
          >
            <LogOut aria-hidden="true" />
            Rời tổ chức
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
