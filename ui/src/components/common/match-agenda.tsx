"use client"

import { useMemo } from "react"
import { ChevronRight, Users } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { Badge } from "@/components/ui/badge"
import { useNow } from "@/hooks/use-now"
import { formatTime } from "@/lib/format"
import { MATCH_PHASE_SWATCH_CLASS, matchPhase } from "@/lib/match-phase"
import { cn } from "@/lib/utils"
import type { MatchSummary } from "@/types/match"

const dayFormatter = new Intl.DateTimeFormat("vi-VN", {
  weekday: "long",
  day: "numeric",
  month: "numeric",
})

/** Khoá gộp theo NGÀY ĐỊA PHƯƠNG. Không dùng `toISOString().slice(0,10)`: nó là ngày UTC, nên
 *  buổi 7h sáng giờ Việt Nam rơi vào 0h UTC cùng ngày nhưng buổi 6h chiều thì sang ngày khác. */
function dayKeyOf(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`
}

/**
 * Input: các buổi trong kỳ + quyền của người xem.
 * Output: Danh sách dọc, gộp theo ngày — dạng xem mặc định trên điện thoại.
 *
 *         Có nó vì lưới lịch không co được xuống màn hẹp: 7 cột trong ~300px là ~36px một ngày,
 *         mà một chip 36px không chứa nổi "19:00" chứ đừng nói tên sân. Danh sách thì mỗi buổi
 *         một hàng full-width, đọc được ngay, và nói được nhiều hơn cả chip: giờ, sân, sĩ số,
 *         mình đã đăng ký chưa, mình phải trả bao nhiêu.
 *
 *         Tự dựng chứ không bật `listPlugin` của FullCalendar: kỳ đang xem vốn đã do trang giữ
 *         (xem lib/match-range), nên phần này không cần thư viện nào — và tự dựng thì hàng chứa
 *         đúng những thứ trên, thay vì phải nắn lại ô tiêu đề của một view có sẵn.
 *
 *         KHÔNG có thẻ xem nhanh: chạm vào hàng là đi thẳng trang chi tiết. Thẻ hover sinh ra
 *         cho lưới, nơi chip quá nhỏ để nói gì — ở đây hàng đã nói hết những thứ thẻ đó nói,
 *         nên chèn thêm một lớp bung ra giữa đường chỉ là một cú chạm phải học.
 *
 *         KHÔNG có nút sửa/huỷ trên hàng: owner muốn sửa hay huỷ thì chạm vào hàng để vào trang
 *         chi tiết, ở đó đã có hai nút này. Thêm một cặp nút nữa ở đây là hai đích bấm cho cùng
 *         một việc, mà hàng vốn đã là MỘT nút chạm — chèn nút con vào cạnh nó thu hẹp đích chạm
 *         chính lại.
 */
export function MatchAgenda({
  matches,
  onSelectMatch,
}: {
  matches: MatchSummary[]
  onSelectMatch: (matchId: string) => void
}) {
  const now = useNow()

  const days = useMemo(() => {
    const grouped = new Map<string, { date: Date; matches: MatchSummary[] }>()
    // Sắp theo giờ bắt đầu TRƯỚC khi gộp: Map giữ thứ tự chèn, nên nhóm ngày cũng ra đúng thứ tự
    // luôn — không phải sắp lần thứ hai ở ngoài.
    const sorted = [...matches].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    )
    for (const match of sorted) {
      const date = new Date(match.startAt)
      const key = dayKeyOf(date)
      const bucket = grouped.get(key)
      if (bucket) bucket.matches.push(match)
      else grouped.set(key, { date, matches: [match] })
    }
    return [...grouped.values()]
  }, [matches])

  const todayKey = dayKeyOf(new Date(now))

  if (days.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Kỳ này chưa có buổi nào.
      </div>
    )
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      {days.map((day) => {
        const isToday = dayKeyOf(day.date) === todayKey
        return (
          <section key={dayKeyOf(day.date)}>
            {/* Tiêu đề ngày DÍNH lên đỉnh vùng cuộn: cuộn qua vài ngày thì câu "đang xem ngày
                nào" luôn còn trên màn hình, không phải cuộn ngược lên tìm. */}
            <h3
              className={cn(
                "sticky top-0 z-10 flex items-center gap-2 border-b bg-card/95 px-1 py-1.5 text-xs font-semibold backdrop-blur",
                isToday ? "text-primary" : "text-muted-foreground",
              )}
            >
              <span className="capitalize">{dayFormatter.format(day.date)}</span>
              {isToday ? <span className="font-bold">· Hôm nay</span> : null}
            </h3>

            {/* Mỗi buổi một THẺ riêng (viền + nền `bg-card`, cùng công thức với `auth-card`),
                không phải hàng nối liền bằng `divide-y`: card tách bạch buổi này với buổi kia,
                dễ quét mắt hơn khi mỗi buổi giờ đã có tới ba nhãn (sĩ số, tham gia, thanh toán). */}
            <ul className="flex flex-col gap-2 px-1 py-2">
              {day.matches.map((match) => {
                const phase = matchPhase(match, now)
                return (
                  <li key={match.id}>
                    <button
                      type="button"
                      onClick={() => onSelectMatch(match.id)}
                      className="flex w-full min-w-0 items-center gap-3 rounded-lg border bg-card px-3 py-2.5 text-left shadow-sm outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
                    >
                      {/* Vạch màu giai đoạn — cùng bộ class với nền chip trên lưới và với ô chú
                          giải, nên không có bản màu thứ hai để trôi lệch. */}
                      <span
                        className={cn(
                          "w-1 shrink-0 self-stretch rounded-full border",
                          MATCH_PHASE_SWATCH_CLASS[phase],
                        )}
                        aria-hidden="true"
                      />

                      <span className="shrink-0 text-sm font-semibold tabular-nums">
                        {formatTime(match.startAt)}
                        <span className="block text-xs font-normal text-muted-foreground">
                          {formatTime(match.endAt)}
                        </span>
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="min-w-0 truncate text-sm font-medium">
                          {match.courtName}
                        </span>

                        {/* Bốn nhãn cùng dạng BADGE, không trộn chữ thường với badge: sĩ số vẫn
                            là chữ trần vì nó là một con số đổi liên tục, không phải một TRẠNG
                            THÁI như tham gia hay đã trả. Tham gia/Không tham gia luôn hiện ra —
                            im lặng khi chưa tham gia dễ đọc nhầm thành "chưa biết".

                            Trạng thái trận (badge đầu) hiện LUÔN chứ không phải `sr-only`: chú
                            giải màu nằm dưới cùng trang, phải cuộn qua cả danh sách mới thấy —
                            trên mobile coi như không ai đọc tới. `MatchStatusBadge` dùng chung
                            với thẻ xem nhanh và trang chi tiết nên không có bản dịch nghĩa màu
                            thứ hai để trôi lệch với vạch màu bên trái hàng. */}
                        <span className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                          <MatchStatusBadge match={match} />

                          <span className="flex items-center gap-1 tabular-nums">
                            <Users className="size-3" aria-hidden="true" />
                            {match.playerCount}/{match.maxPlayers}
                          </span>

                          <Badge variant={match.voted ? "success" : "outline"}>
                            {match.voted ? "Tham gia" : "Không tham gia"}
                          </Badge>

                          {/* Chỉ báo trả hay chưa bằng badge, không lộ SỐ TIỀN ra danh sách —
                              số cụ thể mỗi buổi vốn đã có ở trang chi tiết, còn đây là danh sách
                              lướt nhanh, không phải sao kê. */}
                          {match.myAmount !== null ? (
                            <Badge
                              variant={
                                match.myPaymentStatus === "unpaid" ? "destructive" : "success"
                              }
                            >
                              {match.myPaymentStatus === "unpaid" ? "Chưa trả" : "Đã trả"}
                            </Badge>
                          ) : null}
                        </span>
                      </span>

                      {/* Luôn là con cuối cùng, `shrink-0` — mọi thẻ ghim nút xem ở đúng cùng
                          một chỗ (mép phải, giữa theo chiều dọc của thẻ), bất kể thẻ có bao
                          nhiêu nhãn. */}
                      <ChevronRight
                        className="size-4 shrink-0 self-center text-muted-foreground"
                        aria-hidden="true"
                      />
                    </button>
                  </li>
                )
              })}
            </ul>
          </section>
        )
      })}
    </div>
  )
}
