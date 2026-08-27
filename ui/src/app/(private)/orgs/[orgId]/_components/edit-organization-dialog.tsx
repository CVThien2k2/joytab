"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { useForm } from "react-hook-form"
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
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUpdateOrganization } from "@/hooks/use-organizations-api"
import { MAX_ORGANIZATION_NAME_LENGTH, createOrganizationFormSchema } from "@/schema/organization"
import type { CreateOrganizationPayload, Organization } from "@/types/organization"

/**
 * Input: Tổ chức đang xem + trạng thái mở và hàm đóng.
 * Output: Hộp thoại sửa thông tin tổ chức. Hiện chỉ có tên — mã tham gia đã có khu riêng của nó
 *         (công tắc + hai nút sao chép) vì nó là hành vi, không phải một field để gõ.
 *
 *         Dùng LẠI `createOrganizationFormSchema`: cùng ràng buộc tên, tách ra hai schema là mở
 *         đường cho chúng lệch nhau.
 *
 *         `reset` khi mở lại để form luôn bắt đầu từ tên HIỆN TẠI: user đổi tên, huỷ, mở lại thì
 *         phải thấy tên thật trong DB chứ không phải thứ họ gõ dở lần trước. Cũng cần khi tên đổi
 *         từ nơi khác (tab khác) rồi `router.refresh()` bơm giá trị mới vào.
 */
export function EditOrganizationDialog({
  organization,
  open,
  onClose,
}: {
  organization: Organization
  open: boolean
  onClose: () => void
}) {
  const form = useForm<CreateOrganizationPayload>({
    resolver: zodResolver(createOrganizationFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: organization.name },
  })

  const mutation = useUpdateOrganization(onClose)

  useEffect(() => {
    if (open) form.reset({ name: organization.name })
  }, [open, organization.name, form])

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next && !mutation.isPending) onClose()
      }}
    >
      <DialogContent className="sm:max-w-md">
        {mutation.isPending ? <LoadingOverlay label="Đang lưu" /> : null}

        <form
          onSubmit={form.handleSubmit((payload) =>
            mutation.mutate({ organizationId: organization.id, name: payload.name }),
          )}
          noValidate
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <DialogHeader>
              <DialogTitle>Sửa thông tin tổ chức</DialogTitle>
              <DialogDescription>
                Tên tổ chức hiện với mọi thành viên và trên màn hình lời mời.
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
              <Button type="button" variant="outline" onClick={onClose}>
                Huỷ
              </Button>
              <Button type="submit">
                <Check aria-hidden="true" />
                Lưu
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
