"use client"

import dynamic from "next/dynamic"
import { Spinner } from "@/components/ui/spinner"
import type { CalendarRange, MatchCalendarProps } from "@/components/common/match-calendar-view"

export type { CalendarRange, MatchCalendarProps }

/**
 * FullCalendar chỉ chạy được ở client, và kéo theo khoảng 250KB. Nạp động vì hai lý do:
 * SSR nó là vô nghĩa (nó tự dựng DOM sau khi mount), và những trang không có lịch thì không
 * phải tải phần đó về.
 *
 * Khung chờ cao 480px đúng bằng chiều cao lịch tháng để trang không giật một nhịp khi chunk về.
 */
export const MatchCalendar = dynamic<MatchCalendarProps>(
  () => import("@/components/common/match-calendar-view"),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[480px] items-center justify-center rounded-xl border bg-card">
        <Spinner className="size-5 text-muted-foreground" />
      </div>
    ),
  },
)
