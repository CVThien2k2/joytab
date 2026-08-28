"use client"

import { useMemo, useState } from "react"
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
import { Textarea } from "@/components/ui/textarea"
import { ImageUpload } from "@/components/common/image-upload"
import { useCreatePayment } from "@/hooks/use-payments-api"
import { formatDateTime, formatMoney } from "@/lib/format"
import { MAX_PAYMENT_NOTE_LENGTH } from "@/schema/payment"
import type { OrganizationChargeGroup } from "@/types/payment"

/**
 * Input: nhóm công nợ của MỘT tổ chức + trạng thái mở.
 * Output: Hộp thoại thanh toán: chọn khoản, xem tổng, quét QR, tải ảnh chuyển khoản, gửi.
 *
 *         Mặc định TICK HẾT: người ta vào đây để trả cho xong, không phải để chọn lựa. Ai muốn
 *         trả một phần thì bỏ tick, đó mới là việc hiếm.
 *
 *         Gửi xong là xong — không có nút sửa hay huỷ. Khoản chỉ quay lại danh sách phải trả
 *         khi chủ tổ chức báo chưa nhận được, và lúc đó kèm lý do.
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
  const [proofUrl, setProofUrl] = useState<string | null>(null)
  const [note, setNote] = useState("")

  const selected = unpaid.filter((charge) => !excluded.has(charge.chargeId))
  const total = selected.reduce((sum, charge) => sum + charge.amount, 0)

  const createPayment = useCreatePayment(group.organizationId, () => {
    setExcluded(new Set())
    setProofUrl(null)
    setNote("")
    onOpenChange(false)
  })

  function toggle(chargeId: string): void {
    setExcluded((current) => {
      const next = new Set(current)
      if (next.has(chargeId)) next.delete(chargeId)
      else next.add(chargeId)
      return next
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thanh toán · {group.organizationName}</DialogTitle>
          <DialogDescription>
            Chuyển khoản theo mã QR bên dưới rồi tải ảnh xác nhận lên. Chủ tổ chức sẽ đối soát.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
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
                  <label
                    htmlFor={`charge-${charge.chargeId}`}
                    className="min-w-0 flex-1 cursor-pointer"
                  >
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

          {group.paymentQrUrl ? (
            <div className="flex flex-col items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={group.paymentQrUrl}
                alt={`Mã QR thanh toán của ${group.organizationName}`}
                className="size-48 rounded-lg border bg-card object-contain p-2"
              />
              <p className="text-xs text-muted-foreground">Quét mã để chuyển đúng số tiền trên</p>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label>Ảnh chuyển khoản</Label>
            <ImageUpload
              shape="square"
              size={96}
              value={proofUrl}
              folder="payment-proofs"
              label="Tải ảnh lên"
              name="Ảnh chuyển khoản"
              removeTitle="Gỡ ảnh chuyển khoản?"
              removeDescription="Ảnh vừa chọn sẽ bị gỡ khỏi lần thanh toán này. Bạn sẽ phải tải lại ảnh khác trước khi gửi."
              onUploaded={setProofUrl}
              onRemove={() => setProofUrl(null)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-note">Ghi chú (không bắt buộc)</Label>
            <Textarea
              id="payment-note"
              value={note}
              maxLength={MAX_PAYMENT_NOTE_LENGTH}
              placeholder="Vd: chuyển từ tài khoản của vợ"
              onChange={(event) => setNote(event.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Để sau
          </Button>
          <Button
            type="button"
            disabled={!proofUrl || selected.length === 0 || createPayment.isPending}
            onClick={() =>
              proofUrl &&
              createPayment.mutate({
                chargeIds: selected.map((charge) => charge.chargeId),
                proofUrl,
                note: note.trim() || undefined,
              })
            }
          >
            {createPayment.isPending ? <Spinner className="size-4" /> : null}
            Gửi thanh toán
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
