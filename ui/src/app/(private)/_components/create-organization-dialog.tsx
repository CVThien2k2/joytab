"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Check, Copy, Link2, PartyPopper, Plus } from "lucide-react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogIconHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import { BankAccountFields } from "@/components/common/bank-account-fields"
import { LoadingOverlay } from "@/components/common/loading-overlay"
import { useCreateOrganization } from "@/hooks/use-organizations-api"
import { buildInviteLink, copyText } from "@/lib/clipboard"
import {
  DEFAULT_MALE_RATIO,
  MAX_MALE_RATIO,
  MAX_ORGANIZATION_NAME_LENGTH,
  MIN_MALE_RATIO,
  createOrganizationFormSchema,
} from "@/schema/organization"
import type {
  CreateOrganizationFormValues,
  CreateOrganizationPayload,
  Organization,
} from "@/types/organization"
import type { OrganizationDialogProps } from "./join-organization-dialog"

/**
 * Input: Không nhận props.
 * Output: Nút "Tạo tổ chức" kèm dialog. Tự quản lý `open` để đóng được từ trong onSuccess của
 *         mutation — DialogClose không với tới được thời điểm đó.
 *
 *         Hỏi luôn bốn thứ (tên, tài khoản nhận tiền, hệ số nam, chủ tổ chức đã ứng tiền) thay
 *         vì chỉ hỏi tên rồi đẩy người ta sang màn Cài đặt: cả ba thứ sau đều là quyết định đã
 *         có sẵn trong đầu lúc lập nhóm, mà tách ra thì thành ba lần quay lại cho một việc.
 *         TÊN và TÀI KHOẢN NHẬN TIỀN là bắt buộc — không có tài khoản thì không dựng được mã QR,
 *         tức là tổ chức lập ra mà chưa thu được đồng nào. Hai ô còn lại đã có sẵn giá trị mặc
 *         định nên người không quan tâm bấm Tạo là xong.
 *
 *         HAI BƯỚC: điền form → tạo xong thì hiện MÃ MỜI ngay tại chỗ, chưa đóng vội. Tổ chức
 *         mới tạo đã mở cửa sẵn nên mã có ngay từ giây đầu tiên, mà việc kế tiếp của người vừa
 *         lập nhóm luôn là gửi mã cho người khác — đóng phụt hộp thoại rồi bắt họ đi tìm lại
 *         mã trong trang tổ chức là chen một bước vào đúng lúc họ đang muốn làm việc đó.
 */
export function CreateOrganizationDialog({
  open: controlledOpen,
  onOpenChange,
}: OrganizationDialogProps = {}) {
  const [selfOpen, setSelfOpen] = useState(false)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : selfOpen

  const form = useForm<CreateOrganizationFormValues, unknown, CreateOrganizationPayload>({
    resolver: zodResolver(createOrganizationFormSchema),
    // KHÔNG dùng "onTouched": blur khỏi ô trống (vd bấm nút X) sẽ bung lỗi, dialog cao
    // thêm một dòng, và vì dialog canh giữa nên nó tự dịch lên — nút đang bấm chạy khỏi
    // con trỏ, mouseup rơi ra ngoài nên click không bao giờ thành. Báo lỗi khi submit,
    // rồi mới bám theo từng ký tự.
    mode: "onSubmit",
    reValidateMode: "onChange",
    defaultValues: {
      name: "",
      bankBin: "",
      bankAccountNo: "",
      // Hệ số mặc định trùng với default của cột DB: người không quan tâm tới nó bấm Tạo là
      // xong, và giá trị họ nhận được đúng bằng thứ BE sẽ tự đặt.
      maleRatio: DEFAULT_MALE_RATIO,
      skipOwnerPayment: false,
    },
  })

  // KHÔNG đóng ở onSuccess nữa: tạo xong là chuyển sang bước khoe mã, người dùng tự bấm Xong.
  // Tổ chức vừa tạo đọc từ `mutation.data` — không cần state thứ hai giữ lại cùng một thứ.
  const mutation = useCreateOrganization()
  const created = mutation.data

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
   * Output: Đóng dialog, xoá thứ đã gõ và trả về bước 1 — mở lại phải là form trắng, không
   *         phải tên cũ kèm lỗi cũ (hay màn khoe mã của tổ chức lần trước).
   */
  function close(): void {
    emitOpen(false)
    form.reset()
    // Trả về bước 1 cho lần mở sau. `reset` của mutation xoá luôn `data`, và chính `data` là
    // thứ quyết định đang ở bước nào — nên quên gọi nó là lần mở sau rơi thẳng vào màn khoe mã
    // của tổ chức lần trước.
    mutation.reset()
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
      {/* Rộng hơn `sm` cũ vì form giờ có bốn nhóm ô; hẹp hơn thì ô số tài khoản và
          ô hệ số bị bó lại thành hai cột chữ nhỏ. */}
      <DialogContent className="sm:max-w-md">
        {mutation.isPending ? <LoadingOverlay label="Đang tạo tổ chức" /> : null}

        {created ? (
          <CreatedStep organization={created} onDone={close} />
        ) : (
          // `contents` ở CẢ `form` lẫn `fieldset`: hai thẻ này chỉ gom hành vi (submit, khoá khi
          // đang gửi), không được chiếm một hàng trong lưới ba hàng của hộp thoại. Chiếm thì
          // `DialogBody` mất neo chiều cao, `overflow-y-auto` của nó không có gì để cuộn, và
          // form dài hơn màn hình sẽ tràn khỏi hộp thay vì trượt bên trong.
          <form
            onSubmit={form.handleSubmit((payload) => mutation.mutate(payload))}
            noValidate
            className="contents"
          >
            <fieldset disabled={mutation.isPending} className="contents">
              <DialogHeader>
                <DialogTitle>Tạo tổ chức mới</DialogTitle>
                <DialogDescription>
                  Bạn sẽ là chủ tổ chức. Mời thành viên hoặc mở mã tham gia sau khi tạo.
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
                <Button type="submit">
                  <Plus aria-hidden="true" />
                  Tạo tổ chức
                </Button>
              </DialogFooter>
            </fieldset>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Input: Tổ chức vừa tạo + hàm đóng hộp thoại.
 * Output: Bước 2 — xác nhận đã tạo, rồi đưa thẳng mã mời và hai nút sao chép.
 *
 *         Hai nút chứ không một, y như thẻ mã mời ở trang tổ chức: mã để đọc cho nhau qua điện
 *         thoại hoặc gõ tay vào ô "tham gia bằng mã", còn liên kết để dán vào chat — hai đường
 *         khác nhau, mỗi đường một nút.
 *
 *         `joinCode` về nguyên tắc vẫn nullable (đóng cửa là BE set null), nhưng tổ chức vừa
 *         tạo thì luôn có. Không có thì nói thẳng thay vì hiện một ô rỗng — sai ở đây nghĩa là
 *         BE đã đổi cách tạo mà màn này không biết.
 */
function CreatedStep({ organization, onDone }: { organization: Organization; onDone: () => void }) {
  const [copied, setCopied] = useState<"code" | "link" | null>(null)
  const joinCode = organization.joinCode

  /**
   * Input: Thứ cần chép và nội dung của nó.
   * Output: Chép vào clipboard rồi đổi nhãn đúng nút đó trong 2 giây.
   */
  async function copy(what: "code" | "link", value: string): Promise<void> {
    if (await copyText(value)) {
      setCopied(what)
      toast.success(what === "code" ? "Đã sao chép mã tham gia" : "Đã sao chép liên kết mời")
      setTimeout(() => setCopied(null), 2000)
      return
    }
    toast.error(`Không sao chép được. ${what === "code" ? "Mã" : "Liên kết"}: ${value}`)
  }

  return (
    <>
      <DialogIconHeader
        icon={PartyPopper}
        title={`Đã tạo "${organization.name}"`}
        description="Tổ chức đang mở cửa. Gửi mã hoặc liên kết dưới đây để mời người vào."
      />

      <div className="my-5 space-y-3">
        {joinCode ? (
          <>
            {/* Mã in to, giãn chữ và dùng font đều nét: nó được đọc cho nhau qua điện thoại và
                chép tay, nên nhầm 0 với O là lỗi thật. */}
            <p className="rounded-lg border bg-muted/40 py-3 text-center text-2xl font-semibold tracking-[0.3em] tabular-nums">
              {joinCode}
            </p>

            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => void copy("code", joinCode)}
              >
                {copied === "code" ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
                Chép mã
              </Button>
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => void copy("link", buildInviteLink(joinCode))}
              >
                {copied === "link" ? <Check aria-hidden="true" /> : <Link2 aria-hidden="true" />}
                Chép liên kết
              </Button>
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            Tổ chức đang đóng cửa nên chưa có mã mời. Mở cửa ở trang tổ chức để lấy mã.
          </p>
        )}
      </div>

      <DialogFooter>
        <Button type="button" onClick={onDone}>
          Xong
        </Button>
      </DialogFooter>
    </>
  )
}
