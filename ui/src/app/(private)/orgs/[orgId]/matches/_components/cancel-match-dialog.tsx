"use client"

import { CalendarX2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogIconHeader } from "@/components/ui/dialog"
import { useCancelMatch } from "@/hooks/use-matches-api"
import type { MatchSummary } from "@/types/match"

/**
 * Input: trận muốn huỷ (`null` = chưa chọn gì) + trạng thái mở.
 * Output: Hộp thoại xác nhận huỷ một buổi đá.
 *
 *         Là component riêng vì có HAI chỗ mở nó: thẻ xem nhanh trên lịch (đường của owner khi
 *         đang nhìn cả tuần) và trang chi tiết trận. Hai bản chép tay là hai câu cảnh báo sẽ
 *         trôi mỗi cái một kiểu — mà đây đúng là câu phải giống nhau, vì nó mô tả cùng một hậu
 *         quả không lấy lại được.
 *
 *         Không tự dựng nút bấm: hai chỗ gọi có hình dạng khác hẳn nhau (một nút nhỏ trong thẻ
 *         hover và một nút viền trong khối tiêu đề trang), nên nút thuộc về phía gọi.
 *
 *         `onCanceled` để phía gọi tự xử phần sau: trang chi tiết phải điều hướng đi vì trận vừa
 *         biến mất khỏi lịch, còn trên lịch thì không cần đi đâu cả — danh sách tự làm mới.
 *
 *         Sắc `destructive`: huỷ trận không có nút hoàn tác. Lịch sử đăng ký vẫn nằm trong DB,
 *         nhưng trận đã huỷ không còn hiện trên lưới nên cũng không còn đường nào đi tới nó.
 */
export function CancelMatchDialog({
  match,
  organizationId,
  open,
  onOpenChange,
  onCanceled,
}: {
  match: MatchSummary | null
  organizationId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onCanceled?: () => void
}) {
  const cancel = useCancelMatch(organizationId, () => {
    onOpenChange(false)
    onCanceled?.()
  })

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false}>
        <DialogIconHeader
          icon={CalendarX2}
          tone="destructive"
          title={match ? `Huỷ "${match.courtName}"?` : "Huỷ buổi đá này?"}
          description="Trận sẽ hiện là đã huỷ với mọi người đã đăng ký và biến mất khỏi lịch. Lịch sử đăng ký vẫn giữ lại, nhưng không đăng ký được nữa."
        />

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={cancel.isPending}
            onClick={() => onOpenChange(false)}
          >
            Giữ nguyên
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={cancel.isPending || !match}
            onClick={() => match && cancel.mutate(match.id)}
          >
            {cancel.isPending ? "Đang huỷ" : "Huỷ trận"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
