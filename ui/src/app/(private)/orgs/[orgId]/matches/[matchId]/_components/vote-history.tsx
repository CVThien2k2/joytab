"use client"

import { useState } from "react"
import { ChevronDown, ChevronUp, LogIn, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useMatchHistory } from "@/hooks/use-matches-api"
import { formatDateTime } from "@/lib/format"

/**
 * Input: id trận.
 * Output: Lịch sử đăng ký/huỷ, thu gọn sẵn.
 *
 *         Thu gọn vì đây là thứ chỉ mở khi có tranh cãi ("ai bỏ ngang làm thiếu người"), không
 *         phải thứ nhìn mỗi lần vào trang. Cũng nhờ vậy chỉ gọi API khi thật sự mở ra.
 *
 *         Mọi thành viên xem được, không riêng chủ tổ chức: người cùng đá mới là người cần biết.
 */
export function VoteHistory({ matchId }: { matchId: string }) {
  const [open, setOpen] = useState(false)
  const { data: events, isPending } = useMatchHistory(matchId, open)

  return (
    <section className="overflow-hidden rounded-xl border bg-card">
      <Button
        type="button"
        variant="ghost"
        className="h-auto w-full justify-between rounded-none px-4 py-3"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="text-sm font-semibold">Lịch sử đăng ký</span>
        {open ? (
          <ChevronUp className="size-4" aria-hidden="true" />
        ) : (
          <ChevronDown className="size-4" aria-hidden="true" />
        )}
      </Button>

      {open ? (
        <div className="border-t">
          {isPending ? (
            <div className="flex h-20 items-center justify-center">
              <Spinner className="size-4 text-muted-foreground" />
            </div>
          ) : events && events.length > 0 ? (
            <ul className="divide-y">
              {events.map((event, index) => (
                <li key={`${event.userId}-${event.createdAt}-${index}`} className="flex items-center gap-3 px-4 py-2">
                  {event.action === "join" ? (
                    <LogIn className="size-4 shrink-0 text-primary" aria-hidden="true" />
                  ) : (
                    <LogOut className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {event.fullName ?? "Người đã rời"}{" "}
                    <span className="text-muted-foreground">
                      {event.action === "join" ? "đã đăng ký" : "đã huỷ đăng ký"}
                    </span>
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {formatDateTime(event.createdAt)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-3 text-sm text-muted-foreground">Chưa có thao tác nào.</p>
          )}
        </div>
      ) : null}
    </section>
  )
}
