"use client"

import { Button } from "@/components/ui/button"
import { formatDayLabel, formatMoney, formatTime } from "@/lib/format"
import type { UserCharge } from "@/types/payment"

/**
 * Input: các khoản CHƯA TRẢ của mình + tổng, trả được hay không, và hàm mở hộp thoại trả tiền.
 * Output: Ruột của thanh nhắc nợ: từng khoản đến từ buổi nào, rồi hàng tổng kèm nút thanh toán.
 *
 *         Trả lời đúng câu người ta hỏi trước khi chuyển tiền: "số này ở đâu ra?". Thanh nhắc
 *         chỉ nói MỘT con số tổng, mà bấm thẳng vào một hộp thoại có QR thì người trả đang tin
 *         một con số họ chưa kịp soi. Tách ra hai nhịp — xem đã, rồi mới trả.
 *
 *         Hàng tổng đứng RIÊNG dưới vạch và không cuộn theo danh sách: nợ nhiều buổi thì danh
 *         sách dài hơn khung, mà nút thanh toán trôi khỏi tầm mắt là người ta phải cuộn xuống
 *         đáy mới trả được.
 *
 *         Chưa có tài khoản nhận tiền thì chỗ của nút là một câu nói thẳng phải nhắc ai — thay
 *         vì một đích bấm chỉ để nhận lỗi PAY_005 từ BE.
 */
export function UnpaidChargesPanel({
  charges,
  total,
  payable,
  onPay,
}: {
  charges: UserCharge[]
  total: number
  payable: boolean
  onPay: () => void
}) {
  return (
    <div className="flex max-h-[70svh] flex-col">
      <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto p-3">
        {charges.map((charge) => (
          <li
            key={charge.chargeId}
            className="flex items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{charge.courtName}</p>
              <p className="text-xs text-muted-foreground">
                {formatDayLabel(charge.startAt)} · {formatTime(charge.startAt)}
              </p>
            </div>

            <span className="shrink-0 font-mono text-sm font-semibold tabular-nums">
              {formatMoney(charge.amount)}
              <span className="ml-0.5 text-muted-foreground">đ</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="flex shrink-0 items-center gap-3 border-t px-3 py-2.5">
        <span className="min-w-0 flex-1 text-sm">
          Tổng <span className="font-mono font-semibold tabular-nums">{formatMoney(total)}đ</span>
        </span>

        {payable ? (
          <Button type="button" onClick={onPay}>
            Thanh toán
          </Button>
        ) : (
          <p className="text-xs text-muted-foreground">
            Tổ chức chưa có tài khoản nhận tiền — nhắc chủ tổ chức cấu hình
          </p>
        )}
      </div>
    </div>
  )
}
