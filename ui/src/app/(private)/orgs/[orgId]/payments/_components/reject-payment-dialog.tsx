"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { useRejectPayment } from "@/hooks/use-payments-api"
import { MAX_REJECT_REASON_LENGTH } from "@/schema/payment"

/**
 * Input: id tổ chức + id lần thanh toán.
 * Output: Hộp thoại báo chưa nhận được tiền. Lý do là BẮT BUỘC.
 *
 *         Bắt buộc vì người gửi không có đường tự rút lại: khoản quay về danh sách phải trả
 *         mà không kèm lý do thì họ chỉ thấy nợ tự sống lại, không biết phải làm gì.
 */
export function RejectPaymentDialog({
  organizationId,
  paymentId,
  open,
  onOpenChange,
}: {
  organizationId: string
  paymentId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const [reason, setReason] = useState("")
  const reject = useRejectPayment(organizationId, () => {
    setReason("")
    onOpenChange(false)
  })

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (reject.isPending) return
        onOpenChange(next)
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Báo chưa nhận được tiền</DialogTitle>
          <DialogDescription>
            Các khoản trong lần thanh toán này sẽ quay lại danh sách phải trả của người gửi, kèm
            đúng lý do bạn viết ở đây.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="reject-reason">Lý do</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            maxLength={MAX_REJECT_REASON_LENGTH}
            placeholder="Vd: chưa thấy tiền về tài khoản, hoặc chuyển thiếu 50.000đ"
            onChange={(event) => setReason(event.target.value)}
          />
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Huỷ
          </Button>
          <Button
            type="button"
            variant="destructive"
            disabled={!reason.trim() || reject.isPending}
            onClick={() => reject.mutate({ paymentId, reason: reason.trim() })}
          >
            Gửi phản hồi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
