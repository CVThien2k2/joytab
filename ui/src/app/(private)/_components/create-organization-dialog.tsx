"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Plus } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { useCreateOrganization } from "@/hooks/use-organizations-api"
import { MAX_ORGANIZATION_NAME_LENGTH, createOrganizationFormSchema } from "@/schema/organization"
import type { CreateOrganizationPayload } from "@/types/organization"
import type { OrganizationDialogProps } from "./join-organization-dialog"

/**
 * Input: Không nhận props.
 * Output: Nút "Tạo tổ chức" kèm dialog nhập tên. Tự quản lý `open` để đóng được từ trong
 *         onSuccess của mutation — DialogClose không với tới được thời điểm đó.
 *
 *         Tổ chức mới tạo là KÍN: mã tham gia có sẵn nhưng chưa dùng được cho tới khi owner
 *         bật công tắc, nên form này chỉ hỏi đúng một thứ.
 */
export function CreateOrganizationDialog({
  open: controlledOpen,
  onOpenChange,
}: OrganizationDialogProps = {}) {
  const [selfOpen, setSelfOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : selfOpen

  const form = useForm<CreateOrganizationPayload>({
    resolver: zodResolver(createOrganizationFormSchema),
    // KHÔNG dùng "onTouched": blur khỏi ô trống (vd bấm nút X) sẽ bung lỗi, dialog cao
    // thêm một dòng, và vì dialog canh giữa nên nó tự dịch lên — nút đang bấm chạy khỏi
    // con trỏ, mouseup rơi ra ngoài nên click không bao giờ thành. Báo lỗi khi submit,
    // rồi mới bám theo từng ký tự.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: "" },
  })

  const mutation = useCreateOrganization(() => close())

  /**
   * Input: Trạng thái open mới.
   * Output: Đẩy trạng thái về đúng nơi đang giữ nó — state nội bộ hoặc callback của bên ngoài.
   */
  function emitOpen(nextOpen: boolean): void {
    if (isControlled) onOpenChange?.(nextOpen)
    else setSelfOpen(nextOpen)
  }

  /**
   * Input: Không nhận tham số.
   * Output: Đóng dialog và xoá thứ đã gõ — mở lại phải là form trắng, không phải tên cũ kèm
   *         lỗi cũ. KHÔNG qua handleOpenChange: onSuccess của mutation cũng gọi hàm này, lúc
   *         đó `mutation.isPending` trong closure vẫn là true nên cái chốt ở dưới chặn oan.
   */
  function close(): void {
    emitOpen(false)
    form.reset()
  }

  /**
   * Input: Trạng thái open mới do Radix báo (bấm nút X, Esc, click ra ngoài).
   * Output: Đóng/mở dialog. Chặn đóng trong lúc đang gửi để không mất dấu request đang bay.
   */
  function handleOpenChange(nextOpen: boolean): void {
    if (mutation.isPending) return
    if (nextOpen) emitOpen(true)
    else close()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      {isControlled ? null : (
        <DialogTrigger asChild>
          <Button>
            <Plus aria-hidden="true" />
            Tạo tổ chức
          </Button>
        </DialogTrigger>
      )}
      <DialogContent className="sm:max-w-sm">
        {mutation.isPending ? <LoadingOverlay label="Đang tạo tổ chức" /> : null}
        <form onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))} noValidate>
          <fieldset disabled={mutation.isPending} className="contents">
            <DialogHeader>
              <DialogTitle>Tạo tổ chức mới</DialogTitle>
              <DialogDescription>
                Bạn sẽ là chủ tổ chức. Mời thành viên hoặc mở mã tham gia sau khi tạo.
              </DialogDescription>
            </DialogHeader>

            <Field className="my-5">
              <FieldLabel htmlFor="organizationName">Tên tổ chức</FieldLabel>
              <Input
                id="organizationName"
                autoComplete="off"
                maxLength={MAX_ORGANIZATION_NAME_LENGTH}
                placeholder="Quỹ lớp 12A"
                aria-invalid={!!form.formState.errors.name}
                {...form.register("name")}
              />
              <FieldError errors={[form.formState.errors.name]} />
            </Field>

            <DialogFooter>
              <Button type="submit">
                <Plus aria-hidden="true" />
                Tạo tổ chức
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
