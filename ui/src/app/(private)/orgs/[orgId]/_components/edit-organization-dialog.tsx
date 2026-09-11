"use client"

import { useEffect } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { BankAccountFields } from "@/components/common/bank-account-fields"
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
 * Output: Hộp thoại sửa thông tin tổ chức: tên, tài khoản nhận tiền, hệ số chia tiền mặc định,
 *         và cài đặt chủ tổ chức tự đánh dấu đã trả khi chốt chi phí.
 *
 *         Hệ số HIỂN THỊ ở thẻ đầu trang và chỉ SỬA ở đây: nó là một thuộc tính của tổ chức mà
 *         ai cũng cần biết (nó quyết định mình đóng bao nhiêu), nhưng đổi thì hiếm — để một ô
 *         số nằm thường trực ngoài trang chỉ mời người ta nghịch vào một con số đang chi phối
 *         tiền của cả nhóm.
 *
 *         Tài khoản nhận tiền VÀO ĐÂY (trước kia là ảnh QR lưu ngay khi chọn, nằm riêng ở thẻ
 *         thông tin): giờ nó là hai ô để gõ rồi bấm Lưu, đúng loại với những ô còn lại. Mã tham
 *         gia vẫn không ở đây — cái đó là hành vi bật/tắt, không phải field.
 *
 *         Dùng CHUNG `createOrganizationFormSchema`: cùng ràng buộc, viết lại là mở đường cho
 *         hai bên lệch nhau.
 *
 *         `reset` khi mở lại để form luôn bắt đầu từ tên HIỆN TẠI: user đổi tên, huỷ, mở lại thì
 *         phải thấy tên thật trong DB chứ không phải thứ họ gõ dở lần trước. Cũng cần khi tên đổi
 *         từ nơi khác (tab khác) rồi query `organizations` bơm giá trị mới vào.
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
    defaultValues: toFormValues(organization),
  })

  const mutation = useUpdateOrganization(onClose)

  useEffect(() => {
    if (open) form.reset(toFormValues(organization))
  }, [open, organization, form])

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
            mutation.mutate({ organizationId: organization.id, ...payload }),
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

            <DialogBody className="space-y-4 py-1">
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

              <BankAccountFields
                control={form.control}
                errors={form.formState.errors}
                disabled={mutation.isPending}
              />

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
                <FieldDescription>Giá nam = hệ số × giá nữ</FieldDescription>
                <FieldError errors={[form.formState.errors.maleRatio]} />
              </Field>

              {/* Giá trị FILL SẴN cho ô tích ở màn chốt chi phí — owner vẫn tự tích/bỏ được ở
                  từng lần chốt, đây chỉ là mặc định chung của tổ chức. */}
              <Field>
                <div className="flex items-center justify-between gap-3">
                  <FieldLabel htmlFor="skipOwnerPayment">Chủ tổ chức đã ứng tiền</FieldLabel>
                  <Controller
                    control={form.control}
                    name="skipOwnerPayment"
                    render={({ field }) => (
                      <Switch
                        id="skipOwnerPayment"
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    )}
                  />
                </div>
                <FieldDescription>Phần của chủ tổ chức tự động tính là đã trả</FieldDescription>
              </Field>
            </DialogBody>

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

/**
 * Input: Tổ chức lấy từ query.
 * Output: Giá trị fill vào form.
 *
 *         Tài khoản chưa cấu hình thành hai chuỗi RỖNG chứ không phải undefined: ô input phải
 *         luôn là controlled, và chuỗi rỗng cũng chính là thứ BE hiểu là "gỡ tài khoản" khi
 *         owner xoá trắng hai ô rồi bấm Lưu.
 */
function toFormValues(organization: Organization): EditOrganizationFormValues {
  return {
    name: organization.name,
    bankBin: organization.bankAccount?.bin ?? "",
    bankAccountNo: organization.bankAccount?.accountNo ?? "",
    maleRatio: organization.maleRatio,
    skipOwnerPayment: organization.skipOwnerPayment,
  }
}
