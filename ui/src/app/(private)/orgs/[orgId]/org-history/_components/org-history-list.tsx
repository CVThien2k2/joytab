"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ClipboardList } from "lucide-react"
import { getApiErrorMessage } from "@/api/error"
import { MatchEmptyState } from "@/components/common/match-empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationHistory } from "@/hooks/use-matches-api"
import type { OrganizationHistoryScope } from "@/types/match"
import { OrgHistoryCard } from "./org-history-card"
import { OrgHistoryScopeTabs } from "./org-history-scope-tabs"

/** Câu "chỗ này trống" cho từng tab. Tab nào trống vì lý do nào cũng phải nói ra lý do đó. */
const EMPTY_TEXT: Record<OrganizationHistoryScope, { title: string; description: string }> = {
  all: {
    title: "Chưa có buổi nào trong lịch sử",
    description: "Buổi của tổ chức sẽ hiện ở đây sau khi đá xong.",
  },
  uncollected: {
    title: "Đã thu đủ tiền mọi buổi",
    description: "Buổi nào còn người chưa trả sẽ hiện ở đây.",
  },
  unsettled: {
    title: "Không còn buổi nào chờ chốt giá",
    description: "Buổi đã đá xong mà chưa chốt giá sẽ hiện ở đây.",
  },
}

/**
 * Input: id tổ chức.
 * Output: Nội dung trang Lịch sử tổ chức — ba tab + danh sách thẻ, cuộn tới đáy thì tải thêm.
 *
 *         Cùng khuôn với danh sách ở "Trận của tôi" (lô 20, mốc cuộn, tab nằm trong queryKey),
 *         nhưng là component RIÊNG: hai danh sách khác kiểu dữ liệu, khác thẻ, khác bộ tab và
 *         khác cả câu nói khi trống — gộp lại thì mỗi dòng đều phải kèm một nhánh "trừ khi
 *         đang ở trang kia".
 *
 *         Danh sách PHẲNG, không gộp theo ngày: lịch sử trải nhiều tháng nên phần lớn nhóm
 *         ngày sẽ chỉ có một thẻ. Mỗi thẻ tự mang thứ và ngày ở cột giờ.
 */
export function OrgHistoryList({ organizationId }: { organizationId: string }) {
  const [scope, setScope] = useState<OrganizationHistoryScope>("all")

  const { data, error, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrganizationHistory(organizationId, scope)

  const matches = useMemo(() => data?.pages.flatMap((page) => page.matches) ?? [], [data])
  const pageCount = data?.pages.length ?? 0
  const sentinelRef = useRef<HTMLDivElement | null>(null)

  /**
   * Thấy đáy danh sách là tải lô sau. `rootMargin` 200px để lô mới về TRƯỚC khi người ta cuộn
   * tới hẳn đáy.
   *
   * `pageCount` nằm trong deps để observer được dựng lại sau mỗi lô: lô ngắn hơn chiều cao màn
   * hình thì cái mốc vẫn đang nằm trong khung nhìn, mà đứng yên trong khung nhìn thì không
   * sinh thêm sự kiện intersect nào nữa — danh sách sẽ đứng lại giữa đường.
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

  const empty = EMPTY_TEXT[scope]

  return (
    <div className="flex flex-col gap-4">
      <OrgHistoryScopeTabs value={scope} onChange={setScope} />

      {isPending ? (
        <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="rounded-xl border bg-card p-6 text-center text-sm text-destructive">
          {getApiErrorMessage(error, "Không tải được lịch sử tổ chức. Vui lòng thử lại.")}
        </div>
      ) : matches.length === 0 ? (
        <MatchEmptyState icon={ClipboardList} title={empty.title} description={empty.description} />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <li key={match.id}>
                <OrgHistoryCard match={match} />
              </li>
            ))}
          </ul>

          {/* Mốc cuộn: chỉ dựng khi còn lô sau, nên hết danh sách là nó biến mất luôn. */}
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
