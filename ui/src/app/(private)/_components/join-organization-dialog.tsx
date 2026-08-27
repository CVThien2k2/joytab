"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { KeyRound, LogIn } from "lucide-react"
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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { useJoinOrganization } from "@/hooks/use-organizations-api"
import { JOIN_CODE_LENGTH, joinOrganizationFormSchema } from "@/schema/organization"
import type { JoinOrganizationFormValues, JoinOrganizationPayload } from "@/types/organization"

/** Thừa chỗ cho dấu gạch/khoảng trắng user gõ xen vào — chuẩn hoá sẽ bỏ chúng đi. */
const JOIN_CODE_INPUT_MAX_LENGTH = 16

/**
 * Input: Không nhận props.
 * Output: Nút "Tham gia bằng mã" kèm dialog nhập mã.
 *
 *         `useForm` nhận 3 generic vì schema có transform: giá trị form là chuỗi user gõ,
 *         giá trị sau validate là mã đã chuẩn hoá — nhờ vậy `handleSubmit` đưa thẳng payload
 *         đúng dạng cho mutation, không cần chuẩn hoá lại bằng tay.
 */
export function JoinOrganizationDialog() {
  const [open, setOpen] = useState(false)

  const form = useForm<JoinOrganizationFormValues, unknown, JoinOrganizationPayload>({
    resolver: zodResolver(joinOrganizationFormSchema),
    // KHÔNG dùng "onTouched": blur khỏi ô trống (vd bấm nút X) sẽ bung lỗi, dialog cao
    // thêm một dòng, và vì dialog canh giữa nên nó tự dịch lên — nút đang bấm chạy khỏi
    // con trỏ, mouseup rơi ra ngoài nên click không bao giờ thành. Báo lỗi khi submit,
    // rồi mới bám theo từng ký tự.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: { joinCode: "" },
  })

  const mutation = useJoinOrganization(() => setOpen(false))

  /**
   * Input: Trạng thái open mới của dialog.
   * Output: Đóng/mở dialog, xoá mã đã gõ khi đóng. Chặn đóng trong lúc đang gửi.
   */
  function handleOpenChange(nextOpen: boolean): void {
    if (mutation.isPending) return
    setOpen(nextOpen)
    if (!nextOpen) form.reset()
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline">
          <KeyRound aria-hidden="true" />
          Tham gia bằng mã
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        {mutation.isPending ? <LoadingOverlay label="Đang tham gia" /> : null}
        <form onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))} noValidate>
          <fieldset disabled={mutation.isPending} className="contents">
            <DialogHeader>
              <DialogTitle>Tham gia tổ chức</DialogTitle>
              <DialogDescription>
                Nhập mã {JOIN_CODE_LENGTH} ký tự do chủ tổ chức chia sẻ.
              </DialogDescription>
            </DialogHeader>

            <Field className="my-5">
              <FieldLabel htmlFor="joinCode">Mã tham gia</FieldLabel>
              {/* font-mono + tracking rộng: mã là chuỗi ký tự rời, không phải từ — cho dễ soát
                  lại từng ký tự. autoCapitalize/autoCorrect tắt vì bàn phím di động hay tự
                  sửa mã thành từ có nghĩa. */}
              <Input
                id="joinCode"
                autoComplete="off"
                autoCapitalize="characters"
                autoCorrect="off"
                spellCheck={false}
                maxLength={JOIN_CODE_INPUT_MAX_LENGTH}
                placeholder="ABCD1234"
                className="font-mono tracking-[0.25em] uppercase"
                aria-invalid={!!form.formState.errors.joinCode}
                {...form.register("joinCode")}
              />
              <FieldError errors={[form.formState.errors.joinCode]} />
              <FieldDescription>
                Không phân biệt chữ hoa/thường, gạch nối cũng được.
              </FieldDescription>
            </Field>

            <DialogFooter>
              <Button type="submit">
                <LogIn aria-hidden="true" />
                Tham gia
              </Button>
            </DialogFooter>
          </fieldset>
        </form>
      </DialogContent>
    </Dialog>
  )
}
