"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { Camera, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Spinner } from "@/components/ui/spinner"
import { useCreatePayment } from "@/hooks/use-payments-api"
import { formatDateTime, formatMoney } from "@/lib/format"
import { uploadOneImage } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { UPLOAD_IMAGE_CONTENT_TYPES, UPLOAD_MAX_BYTES } from "@/schema/upload"
import type { OrganizationChargeGroup } from "@/types/payment"

/** QR và ảnh chuyển khoản đứng CÙNG một cỡ, giữa popup — hai nửa của đúng MỘT thao tác (quét
 *  rồi chụp lại), khác kích thước hay lệch tâm chỉ khiến mắt phải đoán cái nào đi với cái nào. */
const PROOF_BOX_CLASS = "size-56"

const MAX_MB = Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)

/**
 * Input: nhóm công nợ của MỘT tổ chức + trạng thái mở.
 * Output: Hộp thoại thanh toán, đúng thứ tự thao tác: quét QR → đối chiếu/bỏ bớt khoản → chụp
 *         lại ảnh chuyển khoản → gửi.
 *
 *         Mặc định TICK HẾT: người ta vào đây để trả cho xong, không phải để chọn lựa. Ai muốn
 *         trả một phần thì bỏ tick, đó mới là việc hiếm.
 *
 *         Ảnh chuyển khoản chỉ giữ ở local (`file`/`preview`) tới lúc bấm "Tôi đã chuyển
 *         khoản" — `handleSubmit` mới thật sự đẩy lên S3 rồi tạo payment với URL đó. Chọn ảnh
 *         xong upload NGAY như trước thì đổi ý bỏ ảnh là để lại một file mồ côi trên S3.
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
  const [excluded, setExcluded] = useState<Set<string>>(new Set())
  // Chỉ GIỮ file, chưa upload: ảnh thật sự lên S3 lúc bấm "Tôi đã chuyển khoản" (xem
  // `handleSubmit`) — chọn nhầm ảnh rồi đổi ý thì không để lại một file mồ côi nào trên S3.
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const selected = unpaid.filter((charge) => !excluded.has(charge.chargeId))
  const total = selected.reduce((sum, charge) => sum + charge.amount, 0)
  const createPayment = useCreatePayment(group.organizationId, () => {
    setExcluded(new Set())
    removeFile()
    onOpenChange(false)
  })
  // Bận trong CẢ hai nhịp: đang đẩy ảnh lên S3 (percent) lẫn đang tạo payment sau đó — người
  // dùng không được đổi/gỡ ảnh giữa chừng của một lần gửi.
  const busy = percent !== null || createPayment.isPending

  // Thu hồi object URL khi đổi ảnh / đóng popup — không có dòng này thì mỗi lần chọn ảnh là
  // một blob nằm lại trong bộ nhớ tới khi reload trang.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  function toggle(chargeId: string): void {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(chargeId)) next.delete(chargeId)
      else next.add(chargeId)
      return next
    })
  }

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

  /** Bấm "Tôi đã chuyển khoản": upload ảnh đang giữ lên S3 rồi mới tạo payment với URL đó. */
  async function handleSubmit(): Promise<void> {
    if (!file || selected.length === 0) return

    setPercent(0)
    try {
      const uploaded = await uploadOneImage({
        folder: "payment-proofs",
        organizationId: group.organizationId,
        file,
        onProgress: setPercent,
      })
      createPayment.mutate({
        chargeIds: selected.map((charge) => charge.chargeId),
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
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thanh toán · {group.organizationName}</DialogTitle>
          <DialogDescription>
            Chuyển khoản theo mã QR bên dưới rồi tải ảnh xác nhận lên. Gửi xong là các khoản này
            được ghi nhận đã trả.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* QR đứng ĐẦU popup, trước cả danh sách khoản: đây là việc người ta làm TRƯỚC —
              quét mã chuyển khoản — còn danh sách khoản chỉ để đối chiếu/bỏ bớt, không phải
              thứ phải đọc trước khi quét. Danh sách dài thì QR vẫn hiện ngay không phải cuộn. */}
          {group.paymentQrUrl ? (
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={group.paymentQrUrl}
                alt={`Mã QR thanh toán của ${group.organizationName}`}
                className={cn(PROOF_BOX_CLASS, "rounded-lg border bg-card object-contain p-2")}
              />
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Khoản thanh toán</Label>
            <ul className="divide-y rounded-lg border">
              {unpaid.map((charge) => (
                <li key={charge.chargeId} className="flex items-center gap-3 p-3">
                  <Checkbox
                    id={`charge-${charge.chargeId}`}
                    checked={!excluded.has(charge.chargeId)}
                    onCheckedChange={() => toggle(charge.chargeId)}
                  />
                  <label htmlFor={`charge-${charge.chargeId}`} className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{charge.courtName}</span>
                    <span className="block text-xs text-muted-foreground">
                      {formatDateTime(charge.startAt)}
                    </span>
                  </label>
                  <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {formatMoney(charge.amount)}đ
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex items-center justify-between rounded-lg bg-muted px-3 py-2">
            <span className="text-sm font-medium">Tổng chuyển khoản</span>
            <span className="text-lg font-bold tabular-nums">{formatMoney(total)}đ</span>
          </div>

          {/* Ảnh chuyển khoản đứng CUỐI, ngay trên nút gửi: đây là thứ CUỐI CÙNG người ta làm
              trước khi bấm gửi, sau khi đã quét QR và đối chiếu khoản — không phải hiện ảnh
              trước rồi bắt kéo mắt ngược lên khoản. Chưa upload lúc chọn, xem `handleSubmit`. */}
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

          <div className="flex flex-col items-center gap-2">
            {/* Bấm vào ô là chọn/đổi ảnh; nút X ở góc chỉ để gỡ. Hai nút ANH EM chồng lên nhau
                bằng `absolute`, không lồng nút trong nút — <button> không được phép chứa phần
                tử tương tác con, lồng vào là HTML sai và trình duyệt tự tách ra không báo trước. */}
            <div className={cn(PROOF_BOX_CLASS, "relative")}>
              <button
                type="button"
                disabled={busy}
                onClick={() => inputRef.current?.click()}
                className="absolute inset-0 overflow-hidden rounded-lg border bg-muted outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:pointer-events-none"
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Ảnh chuyển khoản" className="size-full object-contain" />
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
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button
            type="button"
            disabled={!file || selected.length === 0 || busy}
            onClick={() => void handleSubmit()}
          >
            {busy ? <Spinner className="size-4" /> : null}
            Tôi đã chuyển khoản
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
