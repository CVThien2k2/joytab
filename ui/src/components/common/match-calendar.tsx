"use client"

import dynamic from "next/dynamic"
import { Spinner } from "@/components/ui/spinner"
import type { MatchCalendarProps, MatchMoveRequest } from "@/components/common/match-calendar-view"

export type { MatchCalendarProps, MatchMoveRequest }

/**
 * FullCalendar v7 chạy được cả ở server, nhưng vẫn nạp động với `ssr: false` vì hai lý do
 * khác: lịch vẽ theo MÚI GIỜ MÁY người dùng, nên render trước ở server là mời một lệch
 * hydrate ngay khung hình đầu; và nó kéo theo vài trăm KB mà những trang không có lịch
 * không phải tải về.
 *
 * Khung chờ co giãn y hệt bộ lịch thật (`flex-1 min-h-0`) chứ không cao cố định: lịch ăn hết
 * chiều cao còn lại của cửa sổ, nên một khung chờ cao cố định sẽ làm trang giật một nhịp đúng
 * lúc chunk về. Cũng không có viền, vì bộ lịch thật cũng không có.
 */
export const MatchCalendar = dynamic<MatchCalendarProps>(
  () => import("@/components/common/match-calendar-view"),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    ),
  },
)
