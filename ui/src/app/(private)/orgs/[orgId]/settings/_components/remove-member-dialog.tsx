"use client"

import { Trash2 } from "lucide-react"
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
import { useLastPresent } from "@/hooks/use-last-present"
import { useRemoveOrganizationMember } from "@/hooks/use-organizations-api"
import type { OrganizationMember } from "@/types/organization"

/**
 * Input: id tổ chức + thành viên đang chờ xác nhận xoá (`null` = đóng) + hàm đóng.
 * Output: Hộp thoại xác nhận xoá một người khỏi tổ chức.
 *
 *         `member` vừa là dữ liệu vừa là trạng thái mở: một nguồn sự thật nên không có cảnh
 *         dialog mở mà không biết đang nói về ai.
 *
 *         Nói rõ tên và email người bị xoá: hai thành viên trùng tên là chuyện thường, mà bấm
 *         sai ở đây thì phải mời người ta vào lại.
 *
 *         Chặn đóng trong lúc đang gửi — cùng lý do như các dialog tổ chức khác: đóng giữa
 *         request thì người dùng mất dấu việc đang bay.
 */
export function RemoveMemberDialog({
  organizationId,
  member,
  onClose,
}: {
  organizationId: string
  member: OrganizationMember | null
  onClose: () => void
}) {
  const mutation = useRemoveOrganizationMember(organizationId, onClose)
  // `member` vừa là dữ liệu vừa là trạng thái mở, nên lúc đóng nó về null NGAY trong khi hộp
  // thoại còn đang chạy animation ra — tên người sẽ biến mất và hộp co lại ngay trước lúc mờ
  // đi. Giữ lại người vừa xem cho tới lần mở sau.
  const shown = useLastPresent(member)
  const displayName = shown ? shown.fullName?.trim() || shown.email : ""

  return (
    <Dialog
      open={member !== null}
      onOpenChange={(open) => {
        if (!open && !mutation.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {mutation.isPending ? <LoadingOverlay label="Đang xoá thành viên" /> : null}

        <DialogHeader>
          <DialogTitle>Xoá thành viên khỏi tổ chức?</DialogTitle>
          <DialogDescription>
            <span className="font-medium text-foreground">{displayName}</span>
            {shown && shown.fullName?.trim() ? ` (${shown.email})` : ""} sẽ mất quyền truy cập tổ
            chức này ngay lập tức. Muốn vào lại thì phải dùng mã hoặc liên kết mời.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="mt-5">
          <Button type="button" variant="outline" disabled={mutation.isPending} onClick={onClose}>
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={mutation.isPending}
            onClick={() => {
              if (member) mutation.mutate(member.userId)
            }}
          >
            <Trash2 aria-hidden="true" />
            Xoá thành viên
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
