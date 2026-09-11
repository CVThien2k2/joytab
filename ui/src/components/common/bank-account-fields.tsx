"use client"

import { useMemo, useState } from "react"
import { Check, ChevronsUpDown, Landmark, Search } from "lucide-react"
import type { Control, FieldErrors, FieldValues, Path } from "react-hook-form"
import { Controller } from "react-hook-form"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Spinner } from "@/components/ui/spinner"
import { useBanks } from "@/hooks/use-banks-api"
import { cn } from "@/lib/utils"
import { MAX_BANK_ACCOUNT_NO_LENGTH } from "@/schema/bank"
import type { Bank } from "@/types/bank"

/**
 * Hai ô của form cần: chọn ngân hàng + nhập số tài khoản. Dùng chung ở hộp thoại TẠO và hộp
 * thoại SỬA tổ chức.
 *
 * Đứng thành một component vì hai ô này không tách rời được: chúng cùng mô tả MỘT thứ (tiền
 * chảy về đâu), cùng được validate theo cặp, và cùng rỗng khi tổ chức chưa cấu hình. Để mỗi
 * dialog tự dựng lại là hai bản sao sẽ lệch nhau ở lần sửa thứ ba.
 *
 * GENERIC theo kiểu values của form gọi nó: hai form có shape khác nhau (form tạo còn có ô hệ
 * số) nhưng đều chứa đúng hai field này. Nới thành `Control<any>` thì TypeScript từ chối ngay —
 * `Control` có tham số kiểu ở vị trí contravariant nên `any` không nuốt được.
 */
export function BankAccountFields<
  TFieldValues extends FieldValues,
  TContext,
  TTransformed extends FieldValues,
>({
  control,
  errors,
  disabled,
}: {
  control: Control<TFieldValues, TContext, TTransformed>
  errors: FieldErrors<TFieldValues>
  disabled?: boolean
}) {
  // Hai form đều có đúng hai field này, nhưng generic không biết điều đó — ép kiểu ở ĐÚNG MỘT
  // chỗ thay vì rải `as` khắp phần JSX bên dưới.
  const bankBinName = "bankBin" as Path<TFieldValues>
  const bankAccountNoName = "bankAccountNo" as Path<TFieldValues>
  const bankBinError = errors.bankBin as { message?: string } | undefined
  const bankAccountNoError = errors.bankAccountNo as { message?: string } | undefined

  return (
    <>
      <Field>
        <FieldLabel htmlFor="bankBin">Ngân hàng nhận tiền</FieldLabel>
        <Controller
          control={control}
          name={bankBinName}
          render={({ field }) => (
            <BankPicker
              value={field.value as string}
              onChange={field.onChange}
              disabled={disabled}
              invalid={!!bankBinError}
            />
          )}
        />
        <FieldError errors={[bankBinError]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="bankAccountNo">Số tài khoản</FieldLabel>
        <Controller
          control={control}
          name={bankAccountNoName}
          render={({ field }) => (
            <Input
              id="bankAccountNo"
              autoComplete="off"
              inputMode="numeric"
              // Rộng hơn giới hạn thật một chút: người dán vào hay kèm khoảng trắng, mà
              // khoảng trắng bị bỏ lúc chuẩn hoá chứ không tính vào độ dài.
              maxLength={MAX_BANK_ACCOUNT_NO_LENGTH + 8}
              placeholder="0912345678"
              aria-invalid={!!bankAccountNoError}
              disabled={disabled}
              {...field}
            />
          )}
        />
        <FieldDescription>
          Thành viên quét mã QR sinh từ đây — mã đã có sẵn đúng số tiền phải trả.
        </FieldDescription>
        <FieldError errors={[bankAccountNoError]} />
      </Field>
    </>
  )
}

/**
 * Input: BIN đang chọn (chuỗi rỗng = chưa chọn) + hàm báo BIN mới.
 * Output: Nút mở HỘP THOẠI chọn ngân hàng, có ô tìm và danh sách cuộn được.
 *
 *         Là Dialog chứ không phải Popover, và đây KHÔNG phải lựa chọn thẩm mỹ. Radix Dialog
 *         bọc ruột của nó trong `react-remove-scroll` với `shards: [contentRef]` — chỉ cây DOM
 *         bên trong hộp thoại mới được cuộn. Popover thì portal thẳng ra `document.body`, tức
 *         nằm NGOÀI shard đó, nên wheel event bị nuốt: bấm chọn vẫn được mà lăn chuột thì danh
 *         sách đứng im. Hộp thoại lồng tự là một shard của chính nó nên không dính chuyện đó.
 *
 *         Được vậy thì rộng luôn: `sm:max-w-lg` thay vì bó theo bề ngang của nút, và tên đầy đủ
 *         của ngân hàng có chỗ hiện mà không bị cắt giữa chừng.
 *
 *         Danh sách chỉ TẢI KHI MỞ (`useBanks(open)`): phần lớn người mở hộp thoại tạo tổ chức
 *         sẽ bỏ trống phần ngân hàng, không việc gì bắt họ chờ một lượt gọi mạng cho nó.
 */
function BankPicker({
  value,
  onChange,
  disabled,
  invalid,
}: {
  value: string
  onChange: (bin: string) => void
  disabled?: boolean
  invalid?: boolean
}) {
  const [open, setOpen] = useState(false)
  const [keyword, setKeyword] = useState("")
  const { data: banks, isPending, isError } = useBanks(open)

  const selected = banks?.find((bank) => bank.bin === value)
  const matches = useMemo(() => filterBanks(banks ?? [], keyword), [banks, keyword])

  return (
    <>
      <Button
        id="bankBin"
        type="button"
        variant="outline"
        aria-haspopup="dialog"
        aria-invalid={invalid}
        disabled={disabled}
        className="w-full justify-between font-normal"
        onClick={() => setOpen(true)}
      >
        {/* Chưa tải xong danh sách thì `selected` còn undefined dù đã có BIN — hiện tạm chính
            con số thay vì "Chọn ngân hàng", để lúc mở form sửa không trông như chưa chọn gì. */}
        <span className={cn("truncate", !value && "text-muted-foreground")}>
          {selected ? selected.shortName : value || "Chọn ngân hàng"}
        </span>
        <ChevronsUpDown className="size-4 shrink-0 opacity-50" aria-hidden="true" />
      </Button>

      <Dialog
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          // Mở lại là một lượt tìm MỚI: giữ từ khoá cũ thì lần sau mở ra thấy một danh sách đã
          // bị lọc mà không nhớ tại sao.
          if (!next) setKeyword("")
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Chọn ngân hàng</DialogTitle>
            <DialogDescription>Ngân hàng nhận tiền chuyển khoản của tổ chức.</DialogDescription>
          </DialogHeader>

          <div className="relative">
            <Search
              className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <Input
              // Con trỏ nhảy thẳng vào ô tìm: người mở danh sách này gần như luôn định gõ tên.
              autoFocus
              value={keyword}
              onChange={(event) => setKeyword(event.target.value)}
              placeholder="Tìm theo tên hoặc mã ngân hàng"
              aria-label="Tìm ngân hàng"
              className="pl-9"
            />
          </div>

          {/* `max-h` chặn trên để hộp thoại không cao quá màn hình; DialogBody lo phần cuộn. */}
          <DialogBody className="max-h-[55vh]">
            {isPending ? (
              <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
                <Spinner className="size-4" />
                Đang tải danh sách
              </div>
            ) : isError ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Không tải được danh sách ngân hàng.
              </p>
            ) : matches.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted-foreground">
                Không tìm thấy ngân hàng nào.
              </p>
            ) : (
              <ul className="space-y-0.5">
                {matches.map((bank) => (
                  <li key={bank.bin}>
                    <button
                      type="button"
                      onClick={() => {
                        onChange(bank.bin)
                        setOpen(false)
                        setKeyword("")
                      }}
                      className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left outline-hidden hover:bg-accent focus-visible:bg-accent"
                    >
                      <BankLogo bank={bank} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{bank.shortName}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {bank.name}
                        </span>
                      </span>
                      {bank.bin === value ? (
                        <Check className="size-4 shrink-0" aria-hidden="true" />
                      ) : null}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </DialogBody>
        </DialogContent>
      </Dialog>
    </>
  )
}

/** Logo ngân hàng, lùi về một icon chung khi VietQR không có ảnh cho ngân hàng đó. */
function BankLogo({ bank }: { bank: Bank }) {
  if (!bank.logo) {
    return <Landmark className="size-6 shrink-0 text-muted-foreground" aria-hidden="true" />
  }
  return (
    // Thẻ <img> chứ không next/image: host là CDN của VietQR, không qua loader của Next.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={bank.logo} alt="" className="h-6 w-10 shrink-0 object-contain" />
  )
}

/**
 * Input: Danh sách ngân hàng + từ khoá người dùng gõ.
 * Output: Các ngân hàng khớp, giữ nguyên thứ tự BE đã sắp.
 *
 *         So khớp trên chuỗi ĐÃ BỎ DẤU: người gõ "quan doi" phải ra "Ngân hàng TMCP Quân đội",
 *         vì gõ có dấu trên điện thoại chậm hơn hẳn.
 */
function filterBanks(banks: Bank[], keyword: string): Bank[] {
  const needle = foldAscii(keyword)
  if (!needle) return banks

  return banks.filter((bank) =>
    [bank.shortName, bank.name, bank.code].some((text) => foldAscii(text).includes(needle)),
  )
}

function foldAscii(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[đĐ]/g, "d").toLowerCase().trim()
}
