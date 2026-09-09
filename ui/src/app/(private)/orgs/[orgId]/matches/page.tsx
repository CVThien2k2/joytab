"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Info, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { MatchAgenda } from "@/components/common/match-agenda"
import { MatchCalendar, type MatchMoveRequest } from "@/components/common/match-calendar"
import { MatchCalendarToolbar } from "@/components/common/match-calendar-toolbar"
import { MatchPhaseLegend } from "@/components/common/match-phase-legend"
import { UnpaidChargesBanner } from "@/components/common/unpaid-charges-banner"
import { useOrganizationMatches } from "@/hooks/use-matches-api"
import { useIsMobile } from "@/hooks/use-media-query"
import { useNow } from "@/hooks/use-now"
import { rangeOf, type CalendarPeriod, type CalendarViewName } from "@/lib/match-range"
import type { MatchSummary } from "@/types/match"
import { useActiveOrganization } from "@/stores/organization-store"
import { CancelMatchDialog } from "./_components/cancel-match-dialog"
import { MatchFormDialog } from "./_components/match-form-dialog"
import { MatchRescheduleDialog } from "./_components/match-reschedule-dialog"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang quản lý lịch thi đấu của tổ chức.
 *
 *         Trang giữ MỘT kỳ đang xem (mốc neo + kiểu xem) và suy ra mọi thứ từ đó: khoảng gửi
 *         lên BE, tiêu đề, và phạm vi của bộ lịch. Bộ lịch là thành phần ĐƯỢC ĐIỀU KHIỂN chứ
 *         không tự giữ kỳ của nó — nhờ vậy thanh lọc nằm ở trang vẫn lái được nó.
 *
 *         Thanh lọc và bộ lịch nằm trong CÙNG một thẻ: thanh lọc chỉ đổi kỳ của bộ lịch, tách
 *         ra ngoài thì nó trông như một bộ lọc của cả trang.
 *
 *         Owner có thêm hai thao tác ngay trên lịch: bấm vào chỗ trống để tạo, và kéo thả để
 *         dời. Cả hai đều đi qua một dialog — thao tác trên lưới đủ để CHỌN thời điểm, nhưng
 *         không đủ để chốt nó.
 */
export default function OrganizationMatchesPage() {
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"
  const now = useNow()

  const [anchor, setAnchor] = useState(() => new Date(now))
  const isMobile = useIsMobile()
  const [view, setView] = useState<CalendarViewName>("timeGridWeek")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialStart, setInitialStart] = useState<Date | undefined>(undefined)
  const [initialEnd, setInitialEnd] = useState<Date | null>(null)
  const [moveRequest, setMoveRequest] = useState<MatchMoveRequest | null>(null)
  const [moveOpen, setMoveOpen] = useState(false)
  // Trận owner đang sửa hoặc đang định huỷ. Giữ cả object chứ không giữ id như chỗ khác: hai hộp
  // thoại này CHỤP LẠI trận ở thời điểm bấm — form sửa đã nạp giá trị vào các ô, mà danh sách
  // refetch giữa chừng thì không thể tráo dữ liệu dưới tay người đang gõ.
  const [editing, setEditing] = useState<MatchSummary | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [canceling, setCanceling] = useState<MatchSummary | null>(null)
  const [cancelOpen, setCancelOpen] = useState(false)

  // Mobile là danh sách, hết — không có kiểu xem nào để chọn ở đó. Dẫn xuất chứ không phải một
  // state thứ hai: `view` vẫn giữ nguyên lựa chọn cho màn lớn, nên thu cửa sổ xuống rồi kéo
  // rộng lại là lịch trở về đúng kiểu người ta đang để.
  const period: CalendarPeriod = isMobile ? "agenda" : view

  const range = useMemo(() => rangeOf(anchor, period), [anchor, period])
  const { data: matches, isFetching } = useOrganizationMatches(organization.id, range)

  // Trận đã huỷ không hiện trên lịch: nó không còn là một buổi để đi, và một ô trông y hệt các
  // ô khác mà thực ra đã huỷ thì tệ hơn hẳn một ô trống. Lịch sử của nó vẫn nằm ở BE (huỷ là
  // huỷ mềm), chỉ là không chiếm chỗ trên lưới nữa.
  const visibleMatches = useMemo(
    () => (matches ?? []).filter((match) => match.status !== "canceled"),
    [matches],
  )

  /**
   * Owner bấm "Sửa" / "Huỷ" trong thẻ xem nhanh. Hai hộp thoại phải sống Ở ĐÂY chứ không trong
   * thẻ: Radix đóng thẻ hover ngay khi con trỏ rời nó, mà hộp thoại nằm trong thẻ thì bị unmount
   * đúng lúc vừa mở.
   */
  const openEdit = useCallback((match: MatchSummary) => {
    setEditing(match)
    setEditOpen(true)
  }, [])

  const openCancel = useCallback((match: MatchSummary) => {
    setCanceling(match)
    setCancelOpen(true)
  }, [])

  const openCreate = useCallback((start?: Date, end?: Date | null) => {
    setInitialStart(start)
    setInitialEnd(end ?? null)
    setDialogOpen(true)
  }, [])

  /**
   * Đóng dialog dời lịch. `committed` = server đã nhận; mọi đường còn lại (Huỷ, Esc, bấm ra
   * ngoài, server từ chối) đều phải trả chip về chỗ cũ, nếu không màn hình đang hiển thị một
   * lịch mà server không có.
   */
  const closeMove = useCallback(
    (committed: boolean) => {
      if (!committed) moveRequest?.revert()
      // Chỉ hạ `open`, KHÔNG xoá `moveRequest`: hộp thoại còn animation ra, xoá dữ liệu ngay là
      // nó trống trơn trong lúc đang co lại. Lần kéo sau ghi đè giá trị cũ này.
      setMoveOpen(false)
    },
    [moveRequest],
  )

  const openMove = useCallback((request: MatchMoveRequest) => {
    setMoveRequest(request)
    setMoveOpen(true)
  }, [])

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col px-4 py-4 sm:px-6">
      {/* Nhắc nợ đứng TRÊN lịch: đây là trang ai cũng mở đầu tiên, mà dải này tự ẩn khi không
          nợ gì nên nó không lấy mất chiều cao của lịch trong trường hợp thường. */}
      <UnpaidChargesBanner organizationId={organization.id} />

      {/* `gap-0` vì thanh lọc đã tự chừa khoảng dưới; để cả hai thì thành hai lần khoảng trắng. */}
      <Card size="sm" className="min-h-0 flex-1 gap-0 px-(--card-spacing)">
        <MatchCalendarToolbar
          anchor={anchor}
          view={period}
          loading={isFetching}
          onAnchorChange={setAnchor}
          onViewChange={setView}
          actions={
            isOwner ? (
              <Button type="button" onClick={() => openCreate()}>
                <Plus aria-hidden="true" />
                {/* Chỉ còn icon trên mobile: nhãn "Tạo lịch" chiếm ~64px trên một hàng đã chật,
                    mà dấu cộng cạnh bộ chuyển kiểu xem thì không có nghĩa nào khác. */}
                <span className="hidden md:inline">Tạo lịch</span>
                <span className="sr-only md:hidden">Tạo lịch</span>
              </Button>
            ) : null
          }
        />

        {/* Mobile: danh sách trận, không dùng lại bộ lịch của màn lớn. Nó cũng không nhận
            `onCreateAt`/`onMove` — không có lưới thì không có ô trống để quét chọn, cũng không
            có gì để nhấc lên; owner sửa/huỷ bằng hai nút trên trang chi tiết, chạm vào hàng để
            vào đó. */}
        {isMobile ? (
          <MatchAgenda
            matches={visibleMatches}
            onSelectMatch={(matchId) => router.push(`/orgs/${organization.id}/matches/${matchId}`)}
          />
        ) : (
          <MatchCalendar
            matches={visibleMatches}
            organizationId={organization.id}
            anchor={anchor}
            view={view}
            editable={isOwner}
            onSelectMatch={(matchId) => router.push(`/orgs/${organization.id}/matches/${matchId}`)}
            onEditMatch={isOwner ? openEdit : undefined}
            onCancelMatch={isOwner ? openCancel : undefined}
            onCreateAt={isOwner ? ({ start, end }) => openCreate(start, end) : undefined}
            onMove={isOwner ? openMove : undefined}
          />
        )}

        {/* Hai loại chú thích, cùng ẨN trên mobile nhưng vì hai lý do khác nhau:

            - Cách dùng (rê chuột / kéo thả) ẨN vì ở đó không có con trỏ để rê, mà từ khi kéo thả
              bị tắt hẳn trên mobile thì nửa sau của câu cũng không còn đúng nữa.
            - Chú giải màu ẨN vì lưới màu-là-thông-tin đã đổi sang agenda dạng thẻ: mỗi thẻ tự
              nói trạng thái bằng chữ qua `MatchStatusBadge` (components/common/match-status-badge),
              không phải suy ra từ một quy ước màu phải học trước — chú giải lúc đó là thông tin
              thừa. Trên desktop (lưới) thì vẫn giữ: đây là chỗ DUY NHẤT nói ra nghĩa của ba màu
              nền chip, và agenda vẫn dùng chung bộ màu đó cho vạch bên trái mỗi thẻ.

              CHỈ còn chú giải giai đoạn: trục "mình đã đăng ký chưa" không cần giải nghĩa nữa —
              một dấu tích xanh ở góc chip tự nó đã nói xong, không phải một quy ước để học. */}
        <div className="flex shrink-0 flex-wrap items-center justify-between gap-x-4 gap-y-1 pt-2 text-xs text-muted-foreground">
          <p className="hidden items-start gap-1.5 sm:flex">
            <Info className="mt-px size-3.5 shrink-0" aria-hidden="true" />
            <span>
              Rê chuột hoặc bấm vào một buổi để xem nhanh.
              {isOwner ? " Kéo thả để dời giờ, bấm ô trống để tạo buổi mới." : null}
            </span>
          </p>

          <MatchPhaseLegend className="hidden md:flex" />
        </div>
      </Card>

      {isOwner ? (
        <>
          <MatchFormDialog
            organizationId={organization.id}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialStart={initialStart}
            initialEnd={initialEnd}
          />
          {/* Hộp thoại SỬA đứng riêng với hộp thoại TẠO dù cùng một component: mỗi cái giữ một ô
              `open` riêng nên mở cái này không đóng cái kia, và `match` chỉ có ở bản sửa — đó
              cũng chính là thứ `MatchFormDialog` dùng để biết mình đang ở chế độ nào. */}
          <MatchFormDialog
            organizationId={organization.id}
            open={editOpen}
            onOpenChange={setEditOpen}
            match={editing ?? undefined}
          />
          <CancelMatchDialog
            match={canceling}
            organizationId={organization.id}
            open={cancelOpen}
            onOpenChange={setCancelOpen}
          />
          <MatchRescheduleDialog
            organizationId={organization.id}
            request={moveRequest}
            open={moveOpen}
            onClose={closeMove}
          />
        </>
      ) : null}
    </main>
  )
}
