"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { CalendarPlus } from "lucide-react"
import { MatchCard } from "@/components/common/match-card"
import { MatchEmptyState } from "@/components/common/match-empty-state"
import { Spinner } from "@/components/ui/spinner"
import { useOrganizationUpcomingMatches } from "@/hooks/use-matches-api"
import type { MatchSummary } from "@/types/match"
import { CancelMatchDialog } from "./cancel-match-dialog"
import { CreateMatchButton } from "./create-match-button"
import { MatchFormDialog } from "./match-form-dialog"
import { MatchQuickView } from "./match-quick-view"

/**
 * Input: id tổ chức + người xem có phải owner không.
 * Output: Khối "Buổi sắp diễn ra": một dòng tiêu đề (nút tạo lịch của owner ghim mép phải) rồi
 *         danh sách phẳng, cuộn tới đáy thì tải lô sau.
 *
 *         MỌI buổi phía trước của tổ chức, không giới hạn bao xa: BE trả từng lô 20 dòng theo
 *         cursor (`/matches/upcoming`), nên buổi của tháng sau hay năm sau đều tới được. Trước
 *         đây chỗ này hỏi theo KHOẢNG NGÀY và bị chặn ở trần 92 ngày của API đó.
 *
 *         Lọc là việc của BE: buổi đã huỷ và buổi đã kết thúc không có trong kết quả. "Đã kết
 *         thúc" xét trên giờ TAN, nên buổi đang đá dở vẫn nằm ở đầu danh sách.
 *
 *         Danh sách PHẲNG, không còn gộp theo ngày: mỗi thẻ đã tự mang thứ và ngày ở cột giờ,
 *         mà một tổ chức đá vài buổi một tuần thì phần lớn nhóm ngày chỉ có đúng một thẻ —
 *         lúc đó tiêu đề nhóm nhiều hơn cả nội dung.
 *
 *         Nút "Tạo lịch" đứng cùng hàng với tiêu đề, sát mép phải: nó tạo ra thứ nằm ngay bên
 *         dưới nó. Vẫn hiện khi danh sách rỗng — đó đúng là lúc cần nó nhất.
 *
 *         Bấm một thẻ mở hộp thoại XEM NHANH, không rời trang: xem xong là còn ở nguyên chỗ cũ
 *         để lướt tiếp. Ba hộp thoại (xem nhanh, sửa, huỷ) đều sống Ở ĐÂY chứ không trong thẻ:
 *         mở hộp sửa thì hộp xem nhanh phải đóng lại, mà một hộp thoại không tự đóng mình để
 *         mở hộp khác được.
 */
export function UpcomingMatches({
  organizationId,
  isOwner,
}: {
  organizationId: string
  isOwner: boolean
}) {
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  // Trận đang xem giữ cả object chứ không giữ id: hai hộp thoại sửa/huỷ CHỤP LẠI trận ở thời
  // điểm bấm, mà danh sách thì tự làm mới ngầm — không thể tráo dữ liệu dưới tay người đang gõ.
  const [selected, setSelected] = useState<MatchSummary | null>(null)
  const [quickOpen, setQuickOpen] = useState(false)
  const [editOpen, setEditOpen] = useState(false)
  const [cancelOpen, setCancelOpen] = useState(false)

  const { data, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } =
    useOrganizationUpcomingMatches(organizationId)

  const matches = useMemo(() => data?.pages.flatMap((page) => page.matches) ?? [], [data])
  const pageCount = data?.pages.length ?? 0

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

  const openQuickView = useCallback((match: MatchSummary) => {
    setSelected(match)
    setQuickOpen(true)
  }, [])

  /** Đóng hộp xem nhanh rồi mới mở hộp kia — hai lớp nền mờ chồng nhau thì không nhìn ra gì. */
  const handOver = useCallback((next: (open: boolean) => void) => {
    setQuickOpen(false)
    next(true)
  }, [])

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <h2 className="min-w-0 flex-1 text-base font-semibold tracking-tight">Buổi sắp diễn ra</h2>
        {isOwner ? <CreateMatchButton organizationId={organizationId} /> : null}
      </div>

      {isPending ? (
        <div className="flex h-32 items-center justify-center rounded-xl border bg-card">
          <Spinner className="size-5 text-muted-foreground" />
        </div>
      ) : matches.length === 0 ? (
        <MatchEmptyState
          icon={CalendarPlus}
          title="Chưa có buổi nào sắp diễn ra"
          // Hai câu vì hai người đọc có hai việc khác nhau: owner tạo lịch được ngay (nút ở
          // hàng tiêu đề), thành viên thì chỉ còn chờ.
          description={isOwner ? "Tạo lịch để mọi người đăng ký." : "Chờ chủ tổ chức lên lịch."}
        />
      ) : (
        <>
          <ul className="flex flex-col gap-2">
            {matches.map((match) => (
              <li key={match.id}>
                <MatchCard match={match} votable onSelect={() => openQuickView(match)} />
              </li>
            ))}
          </ul>

          {/* Mốc tải thêm. Có chiều cao thật và một spinner: cuộn tới đáy mà chỉ thấy khoảng
              trắng câm thì người ta tưởng hết danh sách rồi. */}
          {hasNextPage ? (
            <div ref={sentinelRef} className="flex justify-center py-4">
              {isFetchingNextPage ? <Spinner className="size-4 text-muted-foreground" /> : null}
            </div>
          ) : null}
        </>
      )}

      <MatchQuickView
        match={selected}
        isOwner={isOwner}
        open={quickOpen}
        onOpenChange={setQuickOpen}
        onEdit={() => handOver(setEditOpen)}
        onCancel={() => handOver(setCancelOpen)}
      />

      {isOwner ? (
        <>
          <MatchFormDialog
            organizationId={organizationId}
            match={selected ?? undefined}
            open={editOpen}
            onOpenChange={setEditOpen}
          />
          <CancelMatchDialog
            match={selected}
            organizationId={organizationId}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
          />
        </>
      ) : null}
    </section>
  )
}
