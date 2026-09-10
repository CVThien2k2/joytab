"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import type { MatchHistoryFilters } from "@/api/matches"
import { getApiErrorMessage } from "@/api/error"
import { History } from "lucide-react"
import { MatchEmptyState } from "@/components/common/match-empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationMatchHistory } from "@/hooks/use-matches-api"
import type { MatchSummary } from "@/types/match"
import { HistoryMatchCard } from "./history-match-card"
import { HistoryPaymentTabs, type HistoryPaymentTab } from "./history-payment-tabs"
import { MyChargeDialog } from "./my-charge-dialog"

/** Câu "chỗ này trống" cho từng tab. Tab nào trống vì lý do nào cũng phải nói ra lý do đó. */
const EMPTY_TEXT: Record<"all" | "unpaid" | "paid", { title: string; description: string }> = {
  all: {
    title: "Chưa có buổi nào trong lịch sử",
    description: "Buổi bạn đã đăng ký sẽ hiện ở đây sau khi đá xong.",
  },
  unpaid: {
    title: "Không còn khoản nào phải trả",
    description: "Mọi buổi đã chốt tiền của bạn đều đã thanh toán.",
  },
  paid: {
    title: "Chưa có khoản nào đã trả",
    description: "Khoản bạn thanh toán xong sẽ được ghi lại ở đây.",
  },
}

/**
 * Input: id tổ chức.
 * Output: Nội dung trang Lịch sử — ba tab lọc theo tiền + danh sách thẻ, cuộn tới đáy thì tải
 *         thêm.
 *
 *         Danh sách PHẲNG, không gộp theo ngày: lịch sử trải nhiều tháng, nên phần lớn nhóm
 *         ngày sẽ chỉ có một thẻ — lúc đó tiêu đề nhóm nhiều hơn cả nội dung. Mỗi thẻ tự mang
 *         thứ và ngày ở cột giờ.
 *
 *         Tab đang chọn nằm trong queryKey của react-query, nên đổi tab là danh sách tự bắt
 *         đầu lại từ lô đầu — không có bước reset nào phải nhớ gọi bằng tay.
 *
 *         Hộp thoại "Khoản của tôi" thuộc về DANH SÁCH chứ không thuộc về từng thẻ: mỗi lúc
 *         chỉ mở được một, mà danh sách thì cuộn vô hạn — để mỗi thẻ mang một Radix Dialog là
 *         dựng sẵn ngần ấy portal cho một thứ dùng một lần.
 */
export function MatchHistoryList({ organizationId }: { organizationId: string }) {
  const [tab, setTab] = useState<HistoryPaymentTab>(null)
  const [detailMatch, setDetailMatch] = useState<MatchSummary | null>(null)

  const filters = useMemo<MatchHistoryFilters>(() => (tab ? { paymentStatus: [tab] } : {}), [tab])

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

  const empty = EMPTY_TEXT[tab ?? "all"]

  return (
    <div className="flex flex-col gap-4">
      <HistoryPaymentTabs value={tab} onChange={setTab} />

      {isPending ? (
        <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Không tải được lịch sử. Vui lòng thử lại.")}
        </div>
      ) : matches.length === 0 ? (
        <MatchEmptyState icon={History} title={empty.title} description={empty.description} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <li key={match.id}>
                <HistoryMatchCard match={match} onOpenDetail={setDetailMatch} />
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

      {/* Nằm NGOÀI mọi nhánh ở trên để không bị tháo khỏi cây lúc danh sách đổi trạng thái —
          đóng hộp thoại làm react-query đánh dấu lại query nào đó thì một hộp thoại nằm trong
          nhánh sẽ biến mất giữa lúc đang chạy animation ra. */}
      <MyChargeDialog
        organizationId={organizationId}
        match={detailMatch}
        open={detailMatch !== null}
        onOpenChange={(open) => {
          if (!open) setDetailMatch(null)
        }}
      />
    </div>
  )
}
