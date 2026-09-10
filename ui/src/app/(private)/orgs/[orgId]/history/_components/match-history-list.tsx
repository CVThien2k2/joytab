"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import type { MatchHistoryFilters as MatchHistoryQuery } from "@/api/matches"
import { getApiErrorMessage } from "@/api/error"
import { History, SearchX } from "lucide-react"
import { MatchCard } from "@/components/common/match-card"
import { MatchEmptyState } from "@/components/common/match-empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationMatchHistory } from "@/hooks/use-matches-api"
import {
  hasHistoryFilter,
  MatchHistoryFilters,
  NO_HISTORY_FILTER,
  type MatchHistoryFilterValues,
} from "./match-history-filters"

/**
 * Input: ngày người dùng chọn (lịch trả về 0h ngày đó, giờ máy).
 * Output: 0h ngày HÔM SAU, dạng ISO.
 *
 *         Biên `to` của BE là biên MỞ `[from, to)`, nên gửi thẳng 0h của ngày người ta chọn sẽ
 *         cắt mất đúng các buổi trong ngày đó — "đến 30/8" mà không thấy buổi tối 30/8.
 */
function exclusiveEndIso(date: Date): string {
  const next = new Date(date)
  next.setHours(0, 0, 0, 0)
  next.setDate(next.getDate() + 1)
  return next.toISOString()
}

/** 0h của ngày đã chọn, theo giờ máy — người ta lọc theo ngày ở sân, không phải ngày UTC. */
function startOfDayIso(date: Date): string {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start.toISOString()
}

/**
 * Input: id tổ chức.
 * Output: Nội dung trang Lịch sử — thanh lọc + danh sách thẻ, cuộn tới đáy thì tải thêm.
 *
 *         Danh sách PHẲNG, không gộp theo ngày: lịch sử trải nhiều tháng và còn bị lọc, nên
 *         phần lớn nhóm ngày sẽ chỉ có một thẻ — lúc đó tiêu đề nhóm nhiều hơn cả nội dung.
 *         Mỗi thẻ tự mang thứ và ngày ở cột giờ.
 *
 *         Bộ lọc nằm trong queryKey của react-query, nên đổi filter là danh sách tự bắt đầu
 *         lại từ lô đầu — không có bước reset nào phải nhớ gọi bằng tay.
 */
export function MatchHistoryList({ organizationId }: { organizationId: string }) {
  const router = useRouter()
  const [values, setValues] = useState<MatchHistoryFilterValues>(NO_HISTORY_FILTER)

  const filters = useMemo<MatchHistoryQuery>(
    () => ({
      ...(values.range?.from ? { from: startOfDayIso(values.range.from) } : {}),
      ...(values.range?.to ? { to: exclusiveEndIso(values.range.to) } : {}),
      ...(values.status.length > 0 ? { status: values.status } : {}),
      ...(values.paymentStatus.length > 0 ? { paymentStatus: values.paymentStatus } : {}),
    }),
    [values],
  )

  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrganizationMatchHistory(organizationId, filters)

  const matches = useMemo(() => data?.pages.flatMap((page) => page.matches) ?? [], [data])
  const pageCount = data?.pages.length ?? 0
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  /**
   * Thấy đáy danh sách là tải lô sau. `rootMargin` 200px để lô mới về TRƯỚC khi người ta cuộn
   * tới hẳn đáy, không phải nhìn một khoảng trắng rồi mới có nội dung.
   *
   * `pageCount` nằm trong deps để observer được dựng lại sau mỗi lô: lô ngắn hơn chiều cao màn
   * hình thì cái mốc vẫn đang nằm trong khung nhìn, mà đứng yên trong khung nhìn thì không sinh
   * thêm sự kiện intersect nào nữa — danh sách sẽ đứng lại giữa đường.
   */
  useEffect(() => {
    const node = sentinelRef.current
    if (!node || !hasNextPage) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) void fetchNextPage()
      },
      { rootMargin: "200px" },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [hasNextPage, fetchNextPage, pageCount])

  const isFiltering = hasHistoryFilter(values)

  return (
    <div className="flex flex-col gap-4">
      <MatchHistoryFilters values={values} onChange={setValues} />

      {isPending ? (
        <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Không tải được lịch sử. Vui lòng thử lại.")}
        </div>
      ) : matches.length === 0 ? (
        // Hai câu cho hai tình huống khác hẳn nhau: lọc hụt là chuyện của bộ lọc (sửa được
        // ngay), còn chưa có buổi nào là chuyện của tổ chức — gộp một câu thì người đang lọc
        // tưởng mình chưa từng đá buổi nào.
        isFiltering ? (
          <MatchEmptyState
            icon={SearchX}
            title="Không có buổi nào khớp bộ lọc"
            description="Thử nới khoảng ngày hoặc bỏ bớt điều kiện."
          />
        ) : (
          <MatchEmptyState
            icon={History}
            title="Chưa có buổi nào trong lịch sử"
            description="Buổi đã chốt tiền hoặc đã huỷ sẽ hiện ở đây."
          />
        )
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <li key={match.id}>
                <MatchCard
                  match={match}
                  onSelect={(matchId) => router.push(`/orgs/${organizationId}/matches/${matchId}`)}
                />
              </li>
            ))}
          </ul>

          {/* Mốc cuộn: chỉ dựng khi còn lô sau, nên hết danh sách là nó biến mất luôn — không
              có dòng "đã hết" nào phải hiện ở cuối một danh sách vốn đã hết. */}
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
