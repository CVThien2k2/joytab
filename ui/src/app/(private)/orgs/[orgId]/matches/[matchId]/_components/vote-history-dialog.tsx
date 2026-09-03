"use client"

import { LogIn, LogOut } from "lucide-react"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useMatchHistory } from "@/hooks/use-matches-api"
import { formatDateTime } from "@/lib/format"

/**
 * Input: id trận.
 * Output: Danh sách thao tác đăng ký / huỷ, cũ trước.
 *
 *         Là component RIÊNG và chỉ được dựng bên trong `DialogContent`: Radix chỉ mount ruột
 *         hộp thoại khi nó mở, nên `useMatchHistory` cũng chỉ chạy từ lần mở đầu tiên. Vào
 *         trang chi tiết mà không ai hỏi lịch sử thì không tốn request nào.
 */
function HistoryList({ matchId }: { matchId: string }) {
  const { data: events, isPending } = useMatchHistory(matchId)

  // Khung cao CỐ ĐỊNH cho cả ba trạng thái (đang tải / có dữ liệu / trống): nếu để nó cao theo
  // nội dung thì hộp thoại mở ra bé tí rồi giãn ra một nhịp lúc dữ liệu về — đúng kiểu giật mà
  // người ta nhớ lâu hơn cả nội dung.
  if (isPending) {
    return (
      <div className="flex h-[55svh] items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    )
  }

  if (!events || events.length === 0) {
    return (
      <p className="flex h-[55svh] items-center justify-center text-sm text-muted-foreground">
        Chưa có thao tác nào.
      </p>
    )
  }

  return (
    <ol className="h-[55svh] divide-y overflow-y-auto rounded-lg border">
      {events.map((event, index) => (
        <li
          key={`${event.userId}-${event.createdAt}-${index}`}
          className="flex items-start gap-2.5 px-3 py-2.5"
        >
          {event.action === "join" ? (
            <LogIn className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          ) : (
            <LogOut className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          )}
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm">
              {event.fullName ?? "Người đã rời"}{" "}
              <span className="text-muted-foreground">
                {event.action === "join" ? "đã đăng ký" : "đã huỷ đăng ký"}
              </span>
            </p>
            <p className="text-xs text-muted-foreground">{formatDateTime(event.createdAt)}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}

/**
 * Input: id trận + trạng thái mở.
 * Output: Hộp thoại lịch sử đăng ký, danh sách tự cuộn bên trong.
 *
 *         Nằm trong hộp thoại chứ không nằm trên trang: đây là thứ xem LẠI khi có tranh cãi
 *         ("ai đăng ký rồi bỏ"), không phải một bước trong mạch đọc trang — mà một khối dài
 *         hàng chục dòng đặt giữa trang thì ai cũng phải cuộn qua nó để tới phần chi phí.
 *
 *         Mọi thành viên xem được, không riêng chủ tổ chức: người cùng đá mới là người cần biết.
 */
export function VoteHistoryDialog({
  matchId,
  open,
  onOpenChange,
}: {
  matchId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Lịch sử đăng ký</DialogTitle>
          <DialogDescription>
            Toàn bộ lượt đăng ký và huỷ của trận này, cũ trước. Chỉ ghi thêm, không sửa và không
            xoá.
          </DialogDescription>
        </DialogHeader>

        <DialogBody>
          <HistoryList matchId={matchId} />
        </DialogBody>

        <DialogFooter showCloseButton />
      </DialogContent>
    </Dialog>
  )
}
