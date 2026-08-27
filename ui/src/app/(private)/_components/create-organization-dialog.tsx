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
import { Spinner } from "@/components/ui/spinner"
import { useCreateOrganization } from "@/hooks/use-organizations-api"
import { MAX_ORGANIZATION_NAME_LENGTH, createOrganizationFormSchema } from "@/schema/organization"
import type { CreateOrganizationPayload } from "@/types/organization"

/**
 * Input: Không nhận props.
 * Output: Nút "Tạo tổ chức" kèm dialog nhập tên. Tự quản lý `open` để đóng được từ trong
 *         onSuccess của mutation — DialogClose không với tới được thời điểm đó.
 *
 *         Tổ chức mới tạo là KÍN: mã tham gia có sẵn nhưng chưa dùng được cho tới khi owner
 *         bật công tắc, nên form này chỉ hỏi đúng một thứ.
 */
export function CreateOrganizationDialog() {
  const [open, setOpen] = useState(false)

  const form = useForm<CreateOrganizationPayload>({
    resolver: zodResolver(createOrganizationFormSchema),
    mode: "onTouched",
    defaultValues: { name: "" },
  })

  const mutation = useCreateOrganization(() => setOpen(false))

  /**
   * Input: Trạng thái open mới của dialog.
   * Output: Đóng/mở dialog và xoá thứ đã gõ khi đóng — mở lại phải là form trắng, không phải
   *         tên cũ kèm lỗi cũ. Chặn đóng trong lúc đang gửi để không mất dấu request đang bay.
   */
  function handleOpenChange(nextOpen: boolean): void {
    if (mutation.isPending) return
    setOpen(nextOpen)
    if (!nextOpen) form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Plus aria-hidden="true" />
          Tạo tổ chức
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
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
                {mutation.isPending ? <Spinner className="size-4" /> : null}
                {mutation.isPending ? "Đang tạo" : "Tạo tổ chức"}
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
