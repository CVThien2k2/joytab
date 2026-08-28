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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { useUpdateOrganization } from "@/hooks/use-organizations-api"
import {
  MAX_MALE_RATIO,
  MAX_ORGANIZATION_NAME_LENGTH,
  MIN_MALE_RATIO,
  editOrganizationFormSchema,
} from "@/schema/organization"
import type {
  EditOrganizationFormValues,
  EditOrganizationPayload,
  Organization,
} from "@/types/organization"

/**
 * Input: Tổ chức đang xem + trạng thái mở và hàm đóng.
 * Output: Hộp thoại sửa thông tin tổ chức: tên và hệ số chia tiền mặc định.
 *
 *         Hệ số HIỂN THỊ ở thẻ đầu trang và chỉ SỬA ở đây: nó là một thuộc tính của tổ chức mà
 *         ai cũng cần biết (nó quyết định mình đóng bao nhiêu), nhưng đổi thì hiếm — để một ô
 *         số nằm thường trực ngoài trang chỉ mời người ta nghịch vào một con số đang chi phối
 *         tiền của cả nhóm.
 *
 *         Mã tham gia và mã QR KHÔNG ở đây: một cái là hành vi bật/tắt, một cái là ảnh lưu ngay
 *         khi chọn — cả hai đều không phải field để gõ rồi bấm Lưu.
 *
 *         Mở rộng từ `createOrganizationFormSchema`: cùng ràng buộc tên, viết lại là mở đường
 *         cho hai bên lệch nhau.
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
  const form = useForm<EditOrganizationFormValues, unknown, EditOrganizationPayload>({
    resolver: zodResolver(editOrganizationFormSchema),
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { name: organization.name, maleRatio: organization.maleRatio },
  })

  const mutation = useUpdateOrganization(onClose)

  useEffect(() => {
    if (open) form.reset({ name: organization.name, maleRatio: organization.maleRatio })
  }, [open, organization.name, organization.maleRatio, form])

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
            mutation.mutate({
              organizationId: organization.id,
              name: payload.name,
              maleRatio: payload.maleRatio,
            }),
          )}
          noValidate
        >
          <fieldset disabled={mutation.isPending} className="contents">
            <DialogHeader>
              <DialogTitle>Sửa thông tin tổ chức</DialogTitle>
              <DialogDescription>
                Tên hiện với mọi thành viên và trên màn hình lời mời. Hệ số chỉ áp cho lịch tạo mới
                — trận đã tạo giữ hệ số của nó.
              </DialogDescription>
            </DialogHeader>

            <div className="my-5 space-y-4">
              <Field>
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

              <Field>
                <FieldLabel htmlFor="maleRatio">Hệ số nam</FieldLabel>
                {/* Rộng bằng ô tên: hai ô cùng một cột, ô này hẹp lại thì form trông hụt một
                    góc. Đơn vị chuyển xuống dòng mô tả thay vì đứng cạnh ô. */}
                <Input
                  id="maleRatio"
                  type="number"
                  step="0.1"
                  inputMode="decimal"
                  min={MIN_MALE_RATIO}
                  max={MAX_MALE_RATIO}
                  aria-invalid={!!form.formState.errors.maleRatio}
                  {...form.register("maleRatio")}
                />
                <FieldDescription>
                  Số lần nam đóng so với nữ — nữ là mốc 1. Ví dụ 1.2 nghĩa là nam đóng gấp 1.2 lần
                  nữ.
                </FieldDescription>
                <FieldError errors={[form.formState.errors.maleRatio]} />
              </Field>
            </div>

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
