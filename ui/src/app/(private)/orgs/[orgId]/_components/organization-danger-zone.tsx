"use client"

import { useState } from "react"
import { LogOut, Trash2, TriangleAlert, Users, X } from "lucide-react"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useDeleteOrganization, useLeaveOrganization } from "@/hooks/use-organizations-api"
import { useAuthStore } from "@/providers/auth-store-provider"
import type { Organization } from "@/types/organization"

/**
 * Input: Tổ chức đang xem.
 * Output: Khối cuối trang tổ chức, đúng MỘT hành động tuỳ vai trò:
 *  - Member: rời tổ chức.
 *  - Owner: xoá tổ chức. Owner KHÔNG rời được (BE trả ORG_005) vì chưa có chuyển quyền sở hữu —
 *    mất owner là để lại một tổ chức không ai bật/tắt mã mời, không ai xoá được.
 *
 *         Xoá tổ chức bắt gõ lại ĐÚNG tên mới bấm được: rời tổ chức còn vào lại được bằng mã
 *         mời, còn xoá thì không có đường về — thêm một bước tay để không ai xoá vì bấm nhầm.
 *
 *         Là một THẺ độc lập, nằm cuối trang. Dấu hiệu "nguy hiểm" nằm ở icon và màu nút chứ
 *         không ở khung — một cái viền đỏ chạy suốt chiều ngang chỉ để bọc một cái nút thì to
 *         hơn mức nguy hiểm thật của nó.
 */
export function OrganizationDangerZone({ organization }: { organization: Organization }) {
  const userId = useAuthStore((state) => state.user?.userId)
  const [confirming, setConfirming] = useState(false)
  const [typedName, setTypedName] = useState("")
  const isOwner = organization.role === "owner"

  const leave = useLeaveOrganization(organization, userId ?? "")
  const remove = useDeleteOrganization(organization)
  const mutation = isOwner ? remove : leave

  // So sau khi trim để dán tên có sẵn khoảng trắng hai đầu vẫn tính là đúng, nhưng KHÔNG bỏ
  // phân biệt hoa thường: gõ lại đúng từng chữ mới là bằng chứng người dùng đọc kỹ.
  const nameMatches = typedName.trim() === organization.name
  const canConfirm = !mutation.isPending && (!isOwner || nameMatches)

  // Không render khi chưa biết mình là ai: hai hành động này đều cần userId, mà cả hai đều
  // không hoàn lại được nên thà không hiện nút còn hơn hiện một nút bấm vào là lỗi.
  if (!userId) return null

  /**
   * Input: Trạng thái mở mới của hộp thoại.
   * Output: Mở/đóng và xoá chữ đã gõ khi đóng — mở lại phải gõ lại từ đầu. Chặn đóng trong lúc
   *         đang gửi.
   */
  function handleOpenChange(open: boolean): void {
    if (mutation.isPending) return
    setConfirming(open)
    if (!open) setTypedName("")
  }

  return (
    <>
      <section className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold">
              <TriangleAlert className="size-4 text-destructive" aria-hidden="true" />
              {isOwner ? "Xoá tổ chức" : "Rời tổ chức"}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {isOwner
                ? "Xoá vĩnh viễn tổ chức này cùng toàn bộ dữ liệu của nó. Không thể hoàn lại."
                : "Bạn sẽ mất quyền truy cập tổ chức này. Muốn vào lại thì cần mã hoặc liên kết mời."}
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirming(true)}
          >
            {isOwner ? <Trash2 aria-hidden="true" /> : <LogOut aria-hidden="true" />}
            {isOwner ? "Xoá tổ chức" : "Rời tổ chức"}
          </Button>
        </div>
      </section>

      <Dialog open={confirming} onOpenChange={handleOpenChange}>
        {/* showCloseButton tắt: nút X ở góc nằm ngay cạnh tiêu đề cảnh báo, dễ bấm nhầm thành
            "đồng ý". Đóng bằng nút Huỷ, Esc hoặc click ra ngoài — vẫn đủ ba đường ra. */}
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          {mutation.isPending ? (
            <LoadingOverlay label={isOwner ? "Đang xoá tổ chức" : "Đang rời tổ chức"} />
          ) : null}

          <DialogHeader>
            {/* Icon trong ô tròn đỏ đặt trên tiêu đề: người dùng nhận ra "đây là hộp thoại phá
                huỷ" trước khi đọc chữ. Hai hộp thoại (xoá / rời) dùng chung bố cục, chỉ khác
                icon và mức độ đỏ — rời tổ chức không phải thảm hoạ nên dùng sắc nhạt hơn. */}
            <div
              className={
                isOwner
                  ? "flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive"
                  : "flex size-11 items-center justify-center rounded-full bg-muted text-muted-foreground"
              }
            >
              {isOwner ? (
                <TriangleAlert className="size-5" aria-hidden="true" />
              ) : (
                <LogOut className="size-5" aria-hidden="true" />
              )}
            </div>

            <DialogTitle className="mt-3">
              {isOwner ? "Xoá vĩnh viễn tổ chức này?" : `Rời "${organization.name}"?`}
            </DialogTitle>
            <DialogDescription>
              {isOwner ? (
                <>
                  Bạn đang xoá{" "}
                  <span className="font-medium text-foreground">{organization.name}</span>. Việc này
                  không thể hoàn lại.
                </>
              ) : (
                "Bạn sẽ mất quyền truy cập ngay lập tức. Vào lại được nếu chủ tổ chức còn mở mã tham gia hoặc gửi bạn liên kết mời."
              )}
            </DialogDescription>
          </DialogHeader>

          {isOwner ? (
            <>
              {/* Liệt kê cái sẽ mất thay vì một câu "bạn có chắc không": người đọc cần biết
                  mình đang mất gì, chứ không cần bị hỏi lại. */}
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
                <FieldLabel htmlFor="confirmOrganizationName">
                  Gõ lại tên tổ chức để xác nhận
                </FieldLabel>
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
            </>
          ) : null}

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
              {isOwner ? <Trash2 aria-hidden="true" /> : <LogOut aria-hidden="true" />}
              {isOwner ? "Xoá vĩnh viễn" : "Rời tổ chức"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
