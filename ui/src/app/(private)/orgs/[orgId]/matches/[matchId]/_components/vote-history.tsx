"use client"

import { LogIn, LogOut } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"
import { useMatchHistory } from "@/hooks/use-matches-api"
import { formatDateTime } from "@/lib/format"

/**
 * Input: id trận.
 * Output: Lịch sử đăng ký/huỷ, hiện sẵn.
 *
 *         Trước đây khối này thu gọn để khỏi gọi API cho tới lúc có người bấm mở. Nay nó nằm
 *         ở cột riêng bên phải, không còn giành chỗ dọc với thứ gì nữa — mà một khối chỉ có
 *         mỗi cái nút trong một cột trống thì vừa khó hiểu vừa phí cả cột. Đổi lại là thêm một
 *         request mỗi lần vào trang; chấp nhận được vì đây là log của đúng một trận.
 *
 *         Danh sách tự cuộn trong khung: một trận nhiều người đổi ý có thể dài hàng chục dòng,
 *         mà cột phải thì dính theo màn hình — để nó dài ra là kéo cả trang dài theo.
 *
 *         Mọi thành viên xem được, không riêng chủ tổ chức: người cùng đá mới là người cần biết.
 */
export function VoteHistory({ matchId }: { matchId: string }) {
  const { data: events, isPending } = useMatchHistory(matchId)

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <h2 className="border-b px-4 py-3 text-sm font-semibold">Lịch sử đăng ký</h2>

      {isPending ? (
        <div className="flex h-20 items-center justify-center">
          <Spinner className="size-4 text-muted-foreground" />
        </div>
      ) : events && events.length > 0 ? (
        <ul className="max-h-[60svh] divide-y overflow-y-auto">
          {events.map((event, index) => (
            <li
              key={`${event.userId}-${event.createdAt}-${index}`}
              className="flex items-start gap-2.5 px-4 py-2.5"
            >
              {event.action === "join" ? (
                <LogIn className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
              ) : (
                <LogOut
                  className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
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
        </ul>
      ) : (
        <p className="px-4 py-3 text-sm text-muted-foreground">Chưa có thao tác nào.</p>
      )}
    </section>
  )
}
