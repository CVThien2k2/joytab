"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ArrowLeft, ArrowRight, Camera, Check, Copy, Send, X } from "lucide-react"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useCreatePayment } from "@/hooks/use-payments-api"
import { formatDate, formatMoney } from "@/lib/format"
import { uploadOneImage } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { UPLOAD_IMAGE_CONTENT_TYPES, UPLOAD_MAX_BYTES } from "@/schema/upload"
import type { BankAccount } from "@/types/organization"
import type { OrganizationChargeGroup } from "@/types/payment"

/** QR và ảnh chuyển khoản đứng CÙNG một cỡ, CÙNG một chỗ (cột trái) ở hai bước — hai nửa của
 *  đúng MỘT thao tác: quét rồi chụp lại. Đứng yên một chỗ nên lúc trượt bước chỉ có cột chữ
 *  bên phải đổi, cái hộp thì như không rời đi đâu.
 *
 *  288px chứ không 224px như trước: ảnh chuyển khoản là thứ cả nhóm soi lại về sau, mà ở 224px
 *  thì số tiền trên biên lai đã nhỏ tới mức phải mở ảnh gốc mới đọc được.
 *
 *  Cùng cỡ còn giữ hai bước cao BẰNG NHAU, nên trượt qua trượt lại popup không giật chiều cao
 *  — thứ phá cảm giác "một màn hình trượt sang màn hình khác". */
const PROOF_BOX_CLASS = "size-72"

const MAX_MB = Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)

/**
 * Hướng vừa đi giữa hai bước. `null` = chưa đi đâu cả, tức lần mở popup đầu tiên.
 */
type StepDirection = "forward" | "back" | null

/**
 * Input: hướng vừa đi.
 * Output: Class animation cho thân bước ĐANG VÀO.
 *
 *         Chỉ bước đang vào được animate, bước cũ tháo ra ngay: giữ cả hai cùng lúc thì phải
 *         đo chiều cao của chúng để popup không nhảy, mà đo bằng JS cho một hộp thoại hai
 *         bước là cái giá không đáng.
 *
 *         `key` đổi theo bước là điều kiện để animation chạy lại — React tháo node cũ và dựng
 *         node mới, chứ nếu giữ cùng một node thì class `animate-in` chỉ chạy đúng một lần
 *         đầu tiên rồi im.
 */
function stepAnimationClass(direction: StepDirection): string {
  // Lần MỞ popup đầu tiên thì không trượt gì: lúc đó chính hộp thoại đang bay vào, thêm một
  // lớp trượt của nội dung bên trong là hai chuyển động chồng lên nhau trong cùng 300ms.
  if (direction === null) return ""

  return cn(
    "animate-in fade-in duration-300 ease-out",
    direction === "forward" ? "slide-in-from-right-8" : "slide-in-from-left-8",
  )
}

/**
 * Input: tổng tiền + số buổi + có nói khẽ hay không.
 * Output: Khối số tiền giữa popup.
 *
 *         Có mặt ở CẢ hai bước: bước 1 là số phải gõ vào app bank, bước 2 là số phải soi lại
 *         trên ảnh vừa chụp — cùng một con số cho cả hai việc, nên nó không được biến mất giữa
 *         đường. Bước 2 nói khẽ hơn (`compact`) vì lúc đó việc chính là cái ảnh.
 */
function AmountBlock({
  total,
  count,
  compact = false,
}: {
  total: number
  count: number
  compact?: boolean
}) {
  return (
    <div className="flex flex-col items-center gap-0.5 sm:items-start">
      <span className="text-xs text-muted-foreground">
        {compact ? "Số tiền đã chuyển" : "Số tiền cần chuyển"}
      </span>
      <span
        className={cn("font-bold tabular-nums", compact ? "text-xl" : "text-3xl tracking-tight")}
      >
        {formatMoney(total)}đ
      </span>
      {compact ? null : (
        <span className="text-xs text-muted-foreground">
          Gồm {count} buổi chưa trả · trả cả một lần
        </span>
      )}
    </div>
  )
}

/**
 * Input: Tài khoản nhận tiền của tổ chức.
 * Output: Tên ngân hàng + số tài khoản, kèm nút chép số.
 *
 *         Có mặt bên cạnh mã QR chứ không thay nó: quét được thì không ai đọc tới đây, nhưng
 *         quét KHÔNG được là chuyện có thật (app bank cũ, camera mờ, người dùng đang ở máy
 *         tính mà bank thì trên điện thoại). Lúc đó số tài khoản là đường lùi duy nhất, và nó
 *         phải chép được bằng một lần bấm — gõ tay 10 chữ số là gõ sai.
 *
 *         Nút chép chỉ chép SỐ TÀI KHOẢN. Số tiền đã nằm trong mã QR và đã in to ngay trên,
 *         thêm một nút nữa chỉ làm người ta phải chọn.
 */
function BankAccountBlock({ account }: { account: BankAccount }) {
  const [copied, setCopied] = useState(false)

  /**
   * Input: Không nhận tham số.
   * Output: Chép số tài khoản vào clipboard và đổi icon trong 2 giây.
   *
   *         `navigator.clipboard` không có ở ngữ cảnh không bảo mật (http trên máy khác trong
   *         mạng LAN) — hỏng thì nói thẳng, vì im lặng nghĩa là người dùng tưởng đã chép xong
   *         rồi dán ra một số tài khoản cũ còn trong clipboard.
   */
  async function copyAccountNo(): Promise<void> {
    try {
      await navigator.clipboard.writeText(account.accountNo)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("Không chép được. Vui lòng chọn và chép thủ công.")
    }
  }

  return (
    <div className="flex items-center gap-2 rounded-lg border px-2.5 py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs text-muted-foreground">{account.bankShortName}</p>
        <p className="truncate font-medium tabular-nums">{account.accountNo}</p>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Chép số tài khoản"
        onClick={() => void copyAccountNo()}
      >
        {copied ? (
          <Check className="size-4 text-emerald-600" aria-hidden="true" />
        ) : (
          <Copy className="size-4" aria-hidden="true" />
        )}
      </Button>
    </div>
  )
}

/**
 * Input: nhóm công nợ của MỘT tổ chức + trạng thái mở.
 * Output: Hộp thoại thanh toán HAI BƯỚC: quét QR chuyển tiền → chụp lại ảnh đã chuyển.
 *
 *         Hai bước chứ không một màn dài: đây là hai việc xảy ra ở hai nơi khác nhau và cách
 *         nhau vài phút — người ta rời app sang ứng dụng bank, chuyển tiền, rồi mới quay lại.
 *         Dồn cả vào một màn thì lúc quét QR đã phải nhìn thấy ô "tải ảnh lên" chưa dùng được,
 *         còn lúc quay lại thì phải cuộn qua cái QR không còn việc gì.
 *
 *         Bước 1 chỉ có QR và SỐ TIỀN. Không cho chọn buổi nào để trả, không checkbox: đây là
 *         công nợ của chính mình trong một tổ chức, mà một lần chuyển khoản thì chuyển cả —
 *         trả lẻ từng buổi chỉ tạo ra những con số không khớp với bất kỳ tổng nào trên sao kê.
 *
 *         Ảnh chuyển khoản chỉ giữ ở local (`file`/`preview`) tới lúc bấm gửi — `handleSubmit`
 *         mới thật sự đẩy lên S3 rồi tạo payment với URL đó. Chọn ảnh xong upload NGAY thì đổi
 *         ý bỏ ảnh là để lại một file mồ côi trên S3.
 *
 *         Gửi xong là các khoản đó ĐÃ TRẢ ngay — không ai duyệt, và không có nút sửa hay huỷ.
 *         Ảnh chuyển khoản vẫn bắt buộc: nó không còn để ai xét, mà để cả nhóm đối chiếu khi
 *         về sau có người hỏi lại.
 */
export function PayDialog({
  group,
  open,
  onOpenChange,
}: {
  group: OrganizationChargeGroup
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const unpaid = useMemo(
    () => group.charges.filter((charge) => charge.paymentStatus === "unpaid"),
    [group.charges],
  )
  const total = unpaid.reduce((sum, charge) => sum + charge.amount, 0)

  const [step, setStep] = useState<1 | 2>(1)
  // Hướng đi chỉ để chọn chiều trượt: tiến thì bước mới vào từ phải, lùi thì vào từ trái —
  // cùng quy ước với mọi thứ chạy trên một trục ngang, nên không phải học gì mới.
  const [direction, setDirection] = useState<StepDirection>(null)
  // Chỉ GIỮ file, chưa upload: ảnh thật sự lên S3 lúc bấm gửi (xem `handleSubmit`) — chọn nhầm
  // ảnh rồi đổi ý thì không để lại một file mồ côi nào trên S3.
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const createPayment = useCreatePayment(group.organizationId, () => {
    removeFile()
    onOpenChange(false)
  })
  // Bận trong CẢ hai nhịp: đang đẩy ảnh lên S3 (percent) lẫn đang tạo payment sau đó — người
  // dùng không được đổi/gỡ ảnh hay lùi bước giữa chừng của một lần gửi.
  const busy = percent !== null || createPayment.isPending

  // Thu hồi object URL khi đổi ảnh / đóng popup — không có dòng này thì mỗi lần chọn ảnh là
  // một blob nằm lại trong bộ nhớ tới khi reload trang.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function pickFile(picked: File): void {
    if (
      !UPLOAD_IMAGE_CONTENT_TYPES.includes(
        picked.type as (typeof UPLOAD_IMAGE_CONTENT_TYPES)[number],
      )
    ) {
      toast.error("Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF")
      return
    }
    if (picked.size > UPLOAD_MAX_BYTES) {
      toast.error(`Ảnh phải nhỏ hơn ${MAX_MB}MB`)
      return
    }

    if (preview) URL.revokeObjectURL(preview)
    setFile(picked)
    setPreview(URL.createObjectURL(picked))
  }

  function removeFile(): void {
    if (preview) URL.revokeObjectURL(preview)
    setFile(null)
    setPreview(null)
  }

  /** Bấm gửi: upload ảnh đang giữ lên S3 rồi mới tạo payment với URL đó. */
  async function handleSubmit(): Promise<void> {
    if (!file || unpaid.length === 0) return

    setPercent(0)
    try {
      const uploaded = await uploadOneImage({
        folder: "payment-proofs",
        organizationId: group.organizationId,
        file,
        onProgress: setPercent,
      })
      createPayment.mutate({
        chargeIds: unpaid.map((charge) => charge.chargeId),
        proofUrl: uploaded.publicUrl,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại")
    } finally {
      setPercent(null)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* `overflow-x-hidden` KHÔNG dư: `overflow-y-auto` một mình khiến trục X tự tính thành
          `auto` (CSS không cho một trục `visible` khi trục kia đã cuộn). Bước đang vào trượt
          ngang 32px, thừa ra 16px khỏi khung -> Chrome bật thanh cuộn ngang suốt 300ms, ăn 15px
          chiều cao, mà hộp thoại lại căn giữa bằng `-translate-y-1/2` nên cả cái popup nhảy lên
          rồi tụt xuống. Đó chính là cú giật lúc sang bước 2 — chiều lùi trượt từ trái nên không
          bị, vì tràn sang trái thì không cuộn được. */}
      <DialogContent className="max-h-[90svh] overflow-x-hidden overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Thanh toán · {group.organizationName}</DialogTitle>
          {/* Hai câu mô tả dài BẰNG NHAU (43 / 45 ký tự) nên xuống dòng giống nhau ở mọi bề
              ngang — lệch một dòng ở đây là đầu hộp thoại cao lên, mà đầu cao lên thì cả popup
              đổi cỡ đúng lúc đang trượt bước. Câu bước 2 vẫn phải nói "gửi là ghi nhận đã trả":
              đó là chỗ duy nhất cảnh báo việc này không lùi lại được. */}
          <DialogDescription>
            {step === 1
              ? "Quét mã QR — số tiền đã điền sẵn trong mã."
              : "Tải ảnh chuyển khoản. Gửi là ghi nhận đã trả."}
          </DialogDescription>
        </DialogHeader>

        {/* `key={step}` để React dựng node MỚI mỗi lần đổi bước — điều kiện để `animate-in`
            chạy lại; giữ cùng một node thì nó chỉ chạy đúng lần đầu. */}
        <div key={step} className={stepAnimationClass(direction)}>
          {/* Hai bước dùng CÙNG một bố cục: hộp vuông bên trái, cột chữ bên phải. Nhờ vậy lúc
              trượt qua trượt lại chỉ có nội dung đổi, còn khung thì đứng yên — và popup không
              đổi chiều cao vì cả hai bước đều cao đúng bằng cái hộp. Hẹp hơn `sm` thì xếp dọc,
              hộp lên trên. */}
          {step === 1 ? (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              {group.vietQrPayload ? (
                // VẼ tại chỗ từ chuỗi BE gửi, không tải ảnh từ đâu cả: chuỗi đó đã mang sẵn
                // đúng `total` bên dưới, nên mã này và con số kia không thể lệch nhau.
                //
                // `level="M"` là mức sửa lỗi vừa đủ cho một mã quét trên màn hình sáng; cao
                // hơn thì mã dày ô hơn mà chẳng giải quyết vấn đề nào có thật ở đây.
                <div
                  className={cn(
                    PROOF_BOX_CLASS,
                    "grid shrink-0 place-items-center rounded-lg border bg-white p-3",
                  )}
                >
                  <QRCodeSVG
                    value={group.vietQrPayload}
                    level="M"
                    title={`Mã QR thanh toán của ${group.organizationName}`}
                    className="size-full"
                  />
                </div>
              ) : (
                // Lối này gần như không tới được: chỗ duy nhất mở hộp thoại (`UnpaidChargesBar`) đã
                // chặn khi tổ chức chưa có tài khoản. Vẫn nói ra thay vì để một ô trống, vì
                // "không thấy gì" là thứ người dùng không biết phải làm gì với nó.
                <div
                  className={cn(
                    PROOF_BOX_CLASS,
                    "grid shrink-0 place-items-center rounded-lg border border-dashed p-4 text-center text-sm text-muted-foreground",
                  )}
                >
                  Tổ chức chưa có tài khoản nhận tiền — nhắc chủ tổ chức cấu hình
                </div>
              )}

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <AmountBlock total={total} count={unpaid.length} />

                {group.bankAccount ? <BankAccountBlock account={group.bankAccount} /> : null}

                {/* Danh sách buổi ĐỌC THÔI, không checkbox: nó trả lời "số tiền kia gồm những
                    gì", chứ không mời chọn lại — một lần chuyển khoản là trả cả.

                    `max-h-40` + cuộn để nó không kéo dài popup: người nợ 15 buổi thì danh sách
                    dài hơn cả cái QR, mà lúc đó việc chính vẫn là quét mã và gõ số tiền. */}
                <ul className="max-h-40 divide-y overflow-y-auto rounded-lg border text-xs">
                  {unpaid.map((charge) => (
                    <li key={charge.chargeId} className="flex items-center gap-2 px-2.5 py-1.5">
                      <span className="min-w-0 flex-1 truncate font-medium">
                        {charge.courtName}
                      </span>
                      <span className="shrink-0 text-muted-foreground tabular-nums">
                        {formatDate(charge.startAt)}
                      </span>
                      <span className="shrink-0 font-semibold tabular-nums">
                        {formatMoney(charge.amount)}đ
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
              <input
                ref={inputRef}
                type="file"
                accept={UPLOAD_IMAGE_CONTENT_TYPES.join(",")}
                className="hidden"
                disabled={busy}
                onChange={(event) => {
                  const picked = event.target.files?.[0]
                  if (picked) pickFile(picked)
                  // Xoá value để chọn LẠI cùng một file vẫn kích hoạt onChange.
                  event.target.value = ""
                }}
              />

              {/* Bấm vào ô là chọn/đổi ảnh; nút X ở góc chỉ để gỡ. Hai nút ANH EM chồng lên nhau
                  bằng `absolute`, không lồng nút trong nút — <button> không được phép chứa phần
                  tử tương tác con, lồng vào là HTML sai và trình duyệt tự tách ra không báo trước. */}
              <div className={cn(PROOF_BOX_CLASS, "relative shrink-0")}>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => inputRef.current?.click()}
                  className="absolute inset-0 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={preview}
                      alt="Ảnh chuyển khoản"
                      className="size-full object-contain"
                    />
                  ) : (
                    <span className="flex size-full flex-col items-center justify-center gap-1.5 text-muted-foreground">
                      <Camera className="size-6" aria-hidden="true" />
                      <span className="text-sm">Tải ảnh chuyển khoản</span>
                    </span>
                  )}
                </button>

                {percent !== null ? (
                  <span className="pointer-events-none absolute inset-0 grid place-items-center rounded-lg bg-background/70">
                    <Spinner className="size-6 text-primary" />
                  </span>
                ) : null}

                {preview && !busy ? (
                  <button
                    type="button"
                    aria-label="Gỡ ảnh chuyển khoản"
                    onClick={removeFile}
                    className="hover:text-destructive-foreground absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-background/90 text-foreground shadow-sm outline-none hover:bg-destructive focus-visible:ring-[3px] focus-visible:ring-ring/50"
                  >
                    <X className="size-3.5" aria-hidden="true" />
                  </button>
                ) : null}
              </div>

              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <AmountBlock total={total} count={unpaid.length} compact />

                {/* Nói rõ ảnh nào là ảnh dùng được, ngay cạnh ô chọn: gửi lên một ảnh mờ hay
                    cắt mất số tiền thì về sau cả nhóm không đối chiếu được, mà lúc đó khoản
                    đã ghi là đã trả và không có nút sửa. */}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  Ảnh phải đọc được <strong className="font-medium">số tiền</strong> và{" "}
                  <strong className="font-medium">thời gian</strong> chuyển — ảnh chụp màn hình biên
                  lai trong app bank là đủ. Nhỏ hơn {MAX_MB}MB, dạng JPEG / PNG / WebP / GIF.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer cũng ĐỨNG YÊN: hai bước cùng một cặp nút ở cùng một chỗ, chỉ đổi chữ. Nút
            chính luôn nằm bên phải nên tay không phải đi tìm lại sau khi đổi bước. */}
        <DialogFooter>
          {step === 1 ? (
            <>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Để sau
              </Button>
              <Button
                type="button"
                disabled={!group.vietQrPayload}
                onClick={() => {
                  setDirection("forward")
                  setStep(2)
                }}
              >
                Tôi đã chuyển khoản
                <ArrowRight aria-hidden="true" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => {
                  setDirection("back")
                  setStep(1)
                }}
              >
                <ArrowLeft aria-hidden="true" />
                Quay lại
              </Button>
              <Button type="button" disabled={!file || busy} onClick={() => void handleSubmit()}>
                {busy ? <Spinner className="size-4" /> : <Send aria-hidden="true" />}
                Gửi xác nhận
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
