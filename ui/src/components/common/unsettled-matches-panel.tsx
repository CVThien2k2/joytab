"use client"

import { useEffect, useMemo, useRef } from "react"
import { CheckCheck } from "lucide-react"
import { getApiErrorMessage } from "@/api/error"
import { MatchEmptyState } from "@/components/common/match-empty-state"
import { SettleMatchButton } from "@/components/common/settle-match-button"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationHistory } from "@/hooks/use-matches-api"
import { formatDayLabel, formatTimeRange } from "@/lib/format"

/**
 * Input: id tổ chức + tấm đang mở hay không.
 * Output: Ruột của thanh nhắc chốt giá: mọi buổi đã đá xong mà chưa chốt, mỗi dòng một nút chốt.
 *
 *         Là một khối TRONG LUỒNG, không phải hộp thoại: nó nở ra ngay dưới thanh nhắc đã kéo
 *         nó lên, nên không có tấm phủ nào che mất trang phía sau và người ta vẫn thấy mình
 *         đang đứng ở đâu.
 *
 *         Dùng CHUNG query với tab "Chưa chốt giá" của trang Lịch sử tổ chức (cùng queryKey),
 *         nên hai chỗ không bao giờ lệch nhau và mở tấm này ra thường không tốn request nào.
 *
 *         Mỗi dòng chỉ có ĐÚNG những gì cần để nhận ra buổi nào (sân, thứ/ngày, giờ, số người)
 *         rồi tới nút. Không có tổng tiền: buổi chưa chốt thì chưa có con số nào để hiện, và
 *         cũng không có link sang trang chi tiết — chốt được ngay ở đây rồi thì thêm một lối đi
 *         nữa chỉ làm người ta phải chọn.
 *
 *         Cao tối đa 70svh rồi tự cuộn: tấm này đè lên trang chứ không đẩy gì, nên nó nở được
 *         rộng tay — nhưng vẫn phải chừa một khoảng thấy được trang phía sau, chỗ nói cho người
 *         ta biết mình chưa rời đi đâu cả.
 *
 *         Chốt xong buổi cuối cùng thì chỗ này KHÔNG trống trơn mà nói "đã chốt giá hết rồi":
 *         đóng sập ngay lúc bấm xong là người ta không kịp thấy việc mình vừa làm có hiệu lực.
 */
export function UnsettledMatchesPanel({
  organizationId,
  expanded,
}: {
  organizationId: string
  expanded: boolean
}) {
  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrganizationHistory(organizationId, "unsettled")

  const matches = useMemo(() => data?.pages.flatMap((page) => page.matches) ?? [], [data])
  const pageCount = data?.pages.length ?? 0
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  /**
   * Cuộn tới đáy danh sách là tải lô sau — cùng khuôn với `OrgHistoryList`, kể cả `pageCount`
   * trong deps để observer dựng lại sau mỗi lô (lô ngắn hơn khung nhìn thì cái mốc nằm yên
   * trong tầm mắt và không sinh thêm sự kiện intersect nào nữa).
   *
   * `expanded` cũng nằm trong deps, và lúc đóng thì KHÔNG quan sát gì: ruột đóng lại chỉ bị cắt
   * bằng `overflow: hidden`, mốc cuộn vẫn nằm trong tầm nhìn của observer — không chặn thì cả
   * danh sách tự tải hết lô này tới lô khác trong khi tấm đang đóng.
   */
  useEffect(() => {
    const node = sentinelRef.current
    if (!expanded || !node || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage()
      },
      { rootMargin: "200px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [expanded, hasNextPage, fetchNextPage, pageCount])

  return (
    <div className="max-h-[70svh] overflow-y-auto p-3">
      {isPending ? (
        <div className="flex h-32 items-center justify-center">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : error ? (
        <p className="px-2 py-6 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Không tải được danh sách. Vui lòng thử lại.")}
        </p>
      ) : matches.length === 0 ? (
        <MatchEmptyState
          className="border-0 bg-transparent py-10"
          icon={CheckCheck}
          title="Đã chốt giá hết rồi"
          description="Buổi nào đá xong mà chưa chốt giá sẽ hiện ở đây."
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <li
                key={match.id}
                className="flex items-center gap-3 rounded-xl bg-muted/50 px-3.5 py-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{match.courtName}</p>
                  <p className="text-xs text-muted-foreground">
                    {formatDayLabel(match.startAt)} · {formatTimeRange(match.startAt, match.endAt)}{" "}
                    · {match.playerCount} người
                  </p>
                </div>

                <SettleMatchButton matchId={match.id} organizationId={organizationId} />
              </li>
            ))}
          </ul>

          {/* Mốc cuộn: chỉ dựng khi còn lô sau, hết danh sách là nó biến mất luôn. */}
          {hasNextPage ? (
            <div ref={sentinelRef} className="flex h-10 items-center justify-center">
              {isFetchingNextPage ? <Spinner className="size-4 text-muted-foreground" /> : null}
            </div>
          ) : null}
        </>
      )}
    </div>
  )
}
