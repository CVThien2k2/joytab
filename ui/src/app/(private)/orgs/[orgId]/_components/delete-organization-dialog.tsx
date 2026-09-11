"use client"

import { useState } from "react"
import { Trash2, TriangleAlert, Users, X } from "lucide-react"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogFooter, DialogIconHeader } from "@/components/ui/dialog"
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useDeleteOrganization } from "@/hooks/use-organizations-api"
import type { Organization } from "@/types/organization"

/**
 * Input: Tổ chức cần xoá + trạng thái mở.
 * Output: Hộp thoại xác nhận xoá vĩnh viễn, bắt gõ lại ĐÚNG tên mới bấm được.
 *
 *         Bắt gõ lại tên vì xoá không có đường về: rời tổ chức còn vào lại được bằng mã mời,
 *         còn xoá thì không. Một bước tay để không ai xoá vì bấm nhầm.
 *
 *         Đứng riêng một file (trước kia nằm trong `OrganizationDangerZone`) từ khi mọi thao
 *         tác của owner gom vào menu "..." trên thẻ tổng quan: cái còn lại đáng giữ là hộp
 *         thoại này, còn khối thẻ bọc ngoài nó thì không còn chỗ đứng.
 */
export function DeleteOrganizationDialog({
  organization,
  open,
  onOpenChange,
}: {
  organization: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [typedName, setTypedName] = useState("")
  const mutation = useDeleteOrganization(organization)

  // So sau khi trim để dán tên có sẵn khoảng trắng hai đầu vẫn tính là đúng, nhưng KHÔNG bỏ
  // phân biệt hoa thường: gõ lại đúng từng chữ mới là bằng chứng người dùng đọc kỹ.
  const nameMatches = typedName.trim() === organization.name
  const canConfirm = !mutation.isPending && nameMatches

  /**
   * Input: Trạng thái mở mới.
   * Output: Mở/đóng và xoá chữ đã gõ khi đóng — mở lại phải gõ lại từ đầu. Chặn đóng trong lúc
   *         đang gửi.
   */
  function handleOpenChange(next: boolean): void {
    if (mutation.isPending) return
    onOpenChange(next)
    if (!next) setTypedName("")
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {/* showCloseButton tắt: nút X ở góc nằm ngay cạnh tiêu đề cảnh báo, dễ bấm nhầm thành
          "đồng ý". Đóng bằng nút Huỷ, Esc hoặc click ra ngoài — vẫn đủ ba đường ra. */}
      <DialogContent className="sm:max-w-md" showCloseButton={false}>
        {mutation.isPending ? <LoadingOverlay label="Đang xoá tổ chức" /> : null}

        <DialogIconHeader
          icon={TriangleAlert}
          tone="destructive"
          title="Xoá vĩnh viễn tổ chức này?"
          description={
            <>
              Bạn đang xoá <span className="font-medium text-foreground">{organization.name}</span>.
              Việc này không thể hoàn lại.
            </>
          }
        />

        {/* Liệt kê cái sẽ mất thay vì một câu "bạn có chắc không": người đọc cần biết mình đang
            mất gì, chứ không cần bị hỏi lại. */}
        <ul className="mt-4 space-y-2 rounded-lg bg-destructive/8 p-3 text-sm text-destructive">
          <li className="flex items-start gap-2">
            <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            {organization.memberCount > 1
              ? `${organization.memberCount} thành viên mất quyền truy cập ngay lập tức`
              : "Bạn là người duy nhất trong tổ chức này"}
          </li>
          <li className="flex items-start gap-2">
            <X className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Mã tham gia và mọi liên kết mời chết hẳn
          </li>
          <li className="flex items-start gap-2">
            <Trash2 className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            Toàn bộ dữ liệu của tổ chức bị xoá, không có bản lưu
          </li>
        </ul>

        <Field className="mt-4">
          <FieldLabel htmlFor="confirmOrganizationName">Gõ lại tên tổ chức để xác nhận</FieldLabel>
          <Input
            id="confirmOrganizationName"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
            placeholder={organization.name}
            value={typedName}
            onChange={(event) => setTypedName(event.target.value)}
          />
          <FieldDescription>
            Phải khớp chính xác:{" "}
            <span className="font-medium text-foreground">{organization.name}</span>
          </FieldDescription>
        </Field>

        <DialogFooter className="mt-5">
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            onClick={() => handleOpenChange(false)}
          >
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!canConfirm}
            onClick={() => mutation.mutate()}
          >
            <Trash2 aria-hidden="true" />
            Xoá vĩnh viễn
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
