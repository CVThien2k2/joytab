"use client"

import { useState } from "react"
import { Maximize2, QrCode } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ImageUpload } from "@/components/common/image-upload"
import { useUpdatePaymentQr } from "@/hooks/use-organizations-api"
import { cn } from "@/lib/utils"
import type { Organization } from "@/types/organization"

/**
 * Input: tổ chức đang xem.
 * Output: Ô vuông nhỏ ở góc thẻ thông tin — bấm vào mở mã QR ở khổ lớn để quét.
 *
 *         Kích thước do CHỖ DÙNG quyết định qua `className` — ở thẻ thông tin nó là một ô
 *         vuông cao bằng thẻ, nằm sát mép phải. Không chiếm hẳn một thẻ riêng như trước: mã QR
 *         là thứ dùng theo ĐỢT (mở app hàng ngày để xem lịch, quét mã thì mỗi tháng vài lần),
 *         phần lớn thời gian chỉ là một ô ảnh không ai nhìn.
 *
 *         Nhưng vẫn phải quét được, mà ảnh 44px thì điện thoại không đọc nổi — nên bấm vào là
 *         phóng to hẳn lên trong hộp thoại. Lớp phủ hiện khi rê chuột là để người ta biết ô
 *         này bấm được; chỉ một cái ảnh trơ thì không ai đoán ra.
 *
 *         Member thấy và quét được, chỉ owner đổi/gỡ được — nút tải ảnh nằm trong hộp thoại,
 *         không bày ra ngoài trang.
 */
export function PaymentQrButton({
  organization,
  className,
}: {
  organization: Organization
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const isOwner = organization.role === "owner"
  const update = useUpdatePaymentQr()

  // Member mà tổ chức chưa có mã thì không có gì để mở — đừng bày một ô rỗng bấm vào chả thấy gì.
  if (!organization.paymentQrUrl && !isOwner) return null

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={organization.paymentQrUrl ? "Xem mã QR thanh toán" : "Thêm mã QR thanh toán"}
        title={organization.paymentQrUrl ? "Mã QR thanh toán" : "Chưa có mã QR"}
        className={cn("group relative shrink-0 overflow-hidden p-0", className)}
        onClick={() => setOpen(true)}
      >
        {organization.paymentQrUrl ? (
          <>
            {/* Thẻ <img> chứ không next/image: host của bucket khác nhau giữa dev và prod. */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={organization.paymentQrUrl} alt="" className="size-full object-contain p-1" />
            <span className="absolute inset-0 grid place-items-center bg-background/70 opacity-0 transition-opacity group-hover:opacity-100">
              <Maximize2 className="size-5" aria-hidden="true" />
            </span>
          </>
        ) : (
          <QrCode className="size-5 text-muted-foreground" aria-hidden="true" />
        )}
      </Button>

      <Dialog open={open} onOpenChange={(next) => !update.isPending && setOpen(next)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Mã QR thanh toán</DialogTitle>
            <DialogDescription>
              {organization.paymentQrUrl
                ? `Quét mã để chuyển tiền cho ${organization.name}.`
                : "Tổ chức chưa có mã QR nên thành viên chưa gửi thanh toán được."}
            </DialogDescription>
          </DialogHeader>

          {organization.paymentQrUrl ? (
            <div className="mx-auto w-full max-w-64 rounded-lg border bg-card p-3">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={organization.paymentQrUrl}
                alt={`Mã QR thanh toán của ${organization.name}`}
                className="aspect-square w-full object-contain"
              />
            </div>
          ) : null}

          {isOwner ? (
            <div className="mt-2 border-t pt-4">
              <ImageUpload
                shape="square"
                // Ảnh đã hiện ở khổ lớn ngay trên; thêm một bản thu nhỏ nữa chỉ làm rối.
                hidePreview
                value={organization.paymentQrUrl}
                folder="payment-qr"
                label="Tải mã QR"
                name={`Mã QR của ${organization.name}`}
                disabled={update.isPending}
                removeTitle="Xoá mã QR của tổ chức?"
                removeDescription="Thành viên sẽ không gửi thanh toán được cho tới khi bạn tải mã khác lên."
                onUploaded={(publicUrl) =>
                  update.mutate({ organizationId: organization.id, paymentQrUrl: publicUrl })
                }
                onRemove={() =>
                  update.mutate({ organizationId: organization.id, paymentQrUrl: "" })
                }
              />
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </>
  )
}
