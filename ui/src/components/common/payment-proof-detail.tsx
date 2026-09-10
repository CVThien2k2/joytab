"use client"

import { getApiErrorMessage } from "@/api/error"
import { Spinner } from "@/components/ui/spinner"
import { usePayment } from "@/hooks/use-payments-api"
import { formatDateTime, formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Input: id tổ chức + id lần chuyển khoản + buổi đang xem (để tô nền đúng dòng trong danh sách).
 * Output: Chứng từ của MỘT lần chuyển khoản: thời điểm, tổng, ghi chú, ảnh, và các buổi nó trả cho.
 *
 *         Tự tải và tự xử lỗi. Hai chỗ dùng — bảng chia tiền của chủ tổ chức (đối chiếu khoản
 *         của người khác) và "Khoản của tôi" ở Trận của tôi (xem lại lần chuyển của mình) — đều
 *         chỉ có sẵn một `paymentId`, nên để mỗi bên tự gọi query rồi tự dựng lại spinner và
 *         khối lỗi là nhân đôi đúng phần dễ lệch nhau nhất.
 *
 *         KHÔNG có tiêu đề lẫn khung riêng: đây là một khối nằm trong hộp thoại của nơi gọi,
 *         mà chỉ nơi gọi mới biết chứng từ này đang trả lời câu hỏi nào.
 *
 *         BE ép quyền, không phải chỗ này: owner đọc được mọi lần của tổ chức, người khác chỉ
 *         đọc được lần của chính mình, và mọi lối từ chối đều về 404 PAY_001 — tức là rơi vào
 *         nhánh lỗi bên dưới như một chứng từ không tồn tại.
 */
export function PaymentProofDetail({
  organizationId,
  paymentId,
  highlightMatchId,
}: {
  organizationId: string
  paymentId: string
  highlightMatchId: string
}) {
  const { data: payment, isPending, error } = usePayment(organizationId, paymentId)

  if (isPending) {
    return (
      <div className="flex h-40 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (error || !payment) {
    return (
      <p className="rounded-lg border bg-card p-4 text-center text-sm text-destructive">
        {getApiErrorMessage(error, "Không tải được chứng từ. Vui lòng thử lại.")}
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-xs text-muted-foreground">Đã chuyển lúc</dt>
          <dd className="mt-0.5">{formatDateTime(payment.submittedAt)}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Tổng lần chuyển</dt>
          <dd className="mt-0.5 font-semibold tabular-nums">{formatMoney(payment.total)}đ</dd>
        </div>
      </dl>

      {payment.note ? (
        <p className="rounded-lg bg-muted px-3 py-2 text-sm">{payment.note}</p>
      ) : null}

      {/* Ảnh chuyển khoản. Thẻ `img` trần, không `next/image`: đây là ảnh do người dùng tải lên
          một bucket ngoài, không biết trước kích thước và cũng không cần tối ưu — mà cấu hình
          domain cho từng nơi lưu trữ chỉ để hiện một ảnh trong hộp thoại là quá giá.

          Mở được ở tab mới: ảnh chụp màn hình ngân hàng thường dài, thu vào đây thì đọc được
          số tiền nhưng không đọc nổi mã giao dịch. */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Ảnh chuyển khoản</p>
        <a href={payment.proofUrl} target="_blank" rel="noreferrer" className="block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={payment.proofUrl}
            alt="Ảnh chuyển khoản"
            className="max-h-80 w-full rounded-lg border bg-muted object-contain"
          />
        </a>
      </div>

      {/* MỘT lần chuyển khoản trả cho NHIỀU buổi — đó là lý do khối này tồn tại: nhìn con số
          tổng ở trên mà không có danh sách này thì nó không khớp với khoản của buổi đang xem,
          và người đọc sẽ tưởng có gì sai. */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">
          Lần chuyển này trả cho {payment.items.length} buổi
        </p>
        <ul className="divide-y rounded-lg border">
          {payment.items.map((item) => (
            <li
              key={item.matchId}
              className={cn(
                "flex items-center gap-3 px-3 py-2 text-sm",
                // Buổi ĐANG xem được tô nền: danh sách này có nhiều buổi giống nhau về hình
                // dạng, mà câu người đọc đang hỏi là "dòng nào là buổi tôi đang mở".
                item.matchId === highlightMatchId && "bg-muted/60",
              )}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate">{item.courtName}</span>
                <span className="block text-xs text-muted-foreground">
                  {formatDateTime(item.startAt)}
                </span>
              </span>
              <span className="shrink-0 font-medium tabular-nums">{formatMoney(item.amount)}đ</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
