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
 *         Là component riêng chứ không viết thẳng vào trang chi tiết: nó sống cạnh
 *         `match-form-dialog` ở tầng tổ chức, nơi mọi trang trong tổ chức với tới được — câu
 *         cảnh báo cho một hậu quả không lấy lại được thì chỉ nên có đúng một bản.
 *
 *         Không tự dựng nút bấm: nút thuộc về phía gọi, nơi biết nó phải trông như thế nào.
 *
 *         `onCanceled` để phía gọi tự xử phần sau: trang chi tiết phải điều hướng đi vì trận
 *         vừa biến mất khỏi danh sách buổi sắp tới.
 *
 *         Sắc `destructive`: huỷ trận không có nút hoàn tác. Lịch sử đăng ký vẫn nằm trong DB,
 *         nhưng buổi đã huỷ chỉ còn tra được ở trang Lịch sử đấu.
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
