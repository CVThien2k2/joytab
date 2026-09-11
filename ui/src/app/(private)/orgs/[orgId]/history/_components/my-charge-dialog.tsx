"use client"

import { Receipt } from "lucide-react"
import { getApiErrorMessage } from "@/api/error"
import { PaymentProofDetail } from "@/components/common/payment-proof-detail"
import { Badge } from "@/components/ui/badge"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogIconHeader,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useLastPresent } from "@/hooks/use-last-present"
import { useSettlement } from "@/hooks/use-matches-api"
import { formatDayLabel, formatMoney, formatTime } from "@/lib/format"
import { useAuthStore } from "@/stores/auth-store"
import type { MatchSummary } from "@/types/match"

/**
 * Input: id tổ chức + buổi đang mở.
 * Output: Ruột hộp thoại: buổi nào → tính ra sao → đã trả bằng gì.
 *
 *         Khoản của mình được TÌM trong bảng chia tiền bằng id người đang đăng nhập, chứ không
 *         đọc `myAmount` của thẻ: bảng chia tiền mới là chỗ có `ratio` và `paymentId`, mà lấy
 *         số tiền ở một nguồn còn trạng thái ở nguồn khác là mở đường cho hai con số lệch nhau
 *         trong cùng một hộp thoại.
 *
 *         Chỉ hiện khoản của CHÍNH MÌNH. BE cho member đọc cả bảng (mọi người cùng đá thì cùng
 *         biết buổi đó tốn bao nhiêu), nhưng đây là trang sổ riêng — liệt kê tiền của từng người
 *         khác ở đây là trả lời một câu không ai hỏi.
 */
function MyChargeBody({ organizationId, match }: { organizationId: string; match: MatchSummary }) {
  const userId = useAuthStore((state) => state.user?.userId) ?? ""

  // Gọi KHÔNG điều kiện: nút mở hộp thoại chỉ hiện trên buổi đã chốt tiền, nên tới được đây thì
  // luôn có bảng để đọc. Truyền `enabled` theo `status` thì buổi chưa chốt (nếu lọt qua được)
  // sẽ kẹt ở `isPending` mãi mãi — một spinner quay vô tận khó hiểu hơn hẳn câu báo lỗi mà BE
  // trả về ở nhánh dưới.
  const { data: settlement, isPending, error } = useSettlement(match.id, true)

  const myCharge = settlement?.charges.find((charge) => charge.userId === userId) ?? null

  const heading = (
    <div className="min-w-0">
      <p className="truncate text-sm font-semibold">{match.courtName}</p>
      <p className="text-xs text-muted-foreground">
        {formatDayLabel(match.startAt)} · {formatTime(match.startAt)} – {formatTime(match.endAt)}
      </p>
    </div>
  )

  if (isPending) {
    return (
      <div className="space-y-4">
        {heading}
        <div className="flex h-40 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      </div>
    )
  }

  // Không tìm thấy khoản của mình là chuyện không nên xảy ra (nút mở hộp thoại chỉ hiện khi thẻ
  // đã có khoản), nhưng nó vẫn phải nói được gì đó thay vì hiện một bảng chi phí rồi im lặng ở
  // đúng dòng người ta mở nó ra để xem.
  if (error || !settlement || !myCharge) {
    return (
      <div className="space-y-4">
        {heading}
        <p className="rounded-lg border bg-card p-4 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Không tải được khoản của bạn. Vui lòng thử lại.")}
        </p>
      </div>
    )
  }

  const paid = myCharge.paymentStatus === "paid"

  return (
    <div className="space-y-4">
      {heading}

      {/* Chi phí của CẢ buổi. Đây là phần trả lời "vì sao lại là con số đó": khoản của mình chỉ
          là một lát của tổng, mà nhìn lát cắt không có cái bánh thì không kiểm lại được. */}
      <div>
        <p className="mb-1.5 text-xs text-muted-foreground">Chi phí buổi</p>
        <ul className="divide-y rounded-lg border">
          {settlement.expenses.map((expense, index) => (
            <li
              key={`${expense.name}-${index}`}
              className="flex items-center gap-3 px-3 py-2 text-sm"
            >
              <span className="min-w-0 flex-1 truncate">{expense.name}</span>
              {/* Đơn giá × số lượng hiện kèm thành tiền: chi phí hay bị nhớ nhầm là đơn giá,
                  mà chỉ có hai con số cạnh nhau thì mới thấy được cái nào là cái nào. */}
              <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                {expense.quantity} × {formatMoney(expense.unitPrice)}đ
              </span>
              <span className="shrink-0 font-medium tabular-nums">
                {formatMoney(expense.quantity * expense.unitPrice)}đ
              </span>
            </li>
          ))}
          <li className="flex items-center gap-3 bg-muted/60 px-3 py-2 text-sm font-semibold">
            <span className="flex-1">Tổng</span>
            <span className="tabular-nums">{formatMoney(settlement.total)}đ</span>
          </li>
        </ul>
      </div>

      {/* Cách chia + khoản của mình, nằm chung một khối vì chúng là một câu: chia thế nào thì
          ra số này.

          Hệ số nam chỉ hiện khi KHÁC 1: bằng 1 nghĩa là chia đều, mà nói "hệ số nam ×1" thì
          người đọc sẽ đi tìm xem nó ảnh hưởng gì tới con số của mình — câu trả lời là không. */}
      <div className="rounded-lg border p-3">
        <p className="text-xs text-muted-foreground">
          Chia cho {settlement.charges.length} người
          {settlement.maleRatio !== 1 ? ` · hệ số nam ×${settlement.maleRatio}` : ""}
        </p>
        <div className="mt-2 flex items-end justify-between gap-3">
          <span className="text-sm font-medium">Khoản của tôi</span>
          <span className="flex items-center gap-2">
            <span className="font-mono text-lg font-semibold tabular-nums">
              {formatMoney(myCharge.amount)}
              <span className="ml-0.5 text-sm text-muted-foreground">đ</span>
            </span>
            <Badge variant={paid ? "success" : "destructive"}>{paid ? "Đã trả" : "Chưa trả"}</Badge>
          </span>
        </div>
      </div>

      {/* Chứng từ, chỉ khi ĐÃ trả. Chưa trả thì không có khối nào ở đây — và cũng không có nút
          trả tiền: một lần chuyển khoản trả cho nhiều buổi cùng lúc, nên chỗ trả tiền là dải
          nhắc nợ ở đầu trang (nó gom mọi khoản còn nợ vào một lần chuyển), chứ không phải từng
          buổi một. Đặt nút ở đây là mời người ta chuyển khoản lẻ từng buổi. */}
      {paid ? (
        myCharge.paymentId ? (
          <div>
            <p className="mb-1.5 text-xs text-muted-foreground">Chứng từ</p>
            <PaymentProofDetail
              organizationId={organizationId}
              paymentId={myCharge.paymentId}
              highlightMatchId={match.id}
            />
          </div>
        ) : (
          // `paid` mà không có `paymentId`: chủ tổ chức tự đánh dấu đã trả lúc chốt giá, không
          // qua lần chuyển khoản nào. Nói ra thay vì để trống — một dòng "Đã trả" không giải
          // thích được là thứ sẽ bị hỏi lại sau vài tháng.
          <p className="rounded-lg border border-dashed bg-muted/30 p-3 text-sm text-muted-foreground">
            Khoản này được chủ tổ chức đánh dấu đã trả lúc chốt tiền, không qua chuyển khoản nên
            không có chứng từ để đối chiếu.
          </p>
        )
      ) : null}
    </div>
  )
}

/**
 * Input: buổi đang mở (`null` = đang đóng) + id tổ chức + trạng thái mở.
 * Output: Hộp thoại "Khoản của tôi" của một buổi đã chốt tiền trong Trận của tôi.
 *
 *         Chỉ ĐỌC. Trang Trận của tôi là sổ nợ nên thẻ vẫn trơ; hộp thoại này là chỗ duy nhất
 *         trả lời hai câu mà thẻ cố tình không mang: "vì sao lại là số tiền này" và "tôi đã
 *         chuyển bằng gì".
 *
 *         Một instance cho CẢ danh sách, nằm ở `MatchHistoryList` chứ không phải mỗi thẻ một
 *         cái: danh sách cuộn vô hạn nên số thẻ không có trần, mà mỗi thẻ kèm một Radix Dialog
 *         là ngần ấy portal dựng sẵn cho một hộp thoại mỗi lúc chỉ mở được một.
 */
export function MyChargeDialog({
  organizationId,
  match,
  open,
  onOpenChange,
}: {
  organizationId: string
  match: MatchSummary | null
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  // Buổi về null NGAY lúc đóng, trong khi Radix còn giữ hộp thoại thêm 150ms để chạy animation
  // ra — ruột rỗng đi rồi hộp co lại ngay trước lúc mờ. Giữ lại buổi vừa xem cho tới lần mở sau.
  const shown = useLastPresent(match)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogIconHeader
          icon={Receipt}
          title="Khoản của tôi"
          description="Buổi này chia tiền thế nào và bạn đã chuyển bằng gì. Chỉ để đối chiếu, không sửa được."
        />

        <DialogBody>
          {shown ? <MyChargeBody organizationId={organizationId} match={shown} /> : null}
        </DialogBody>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
