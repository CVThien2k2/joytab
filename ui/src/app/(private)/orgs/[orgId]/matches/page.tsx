"use client"

import { useCallback, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, List, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MatchCalendar, type MatchMoveRequest } from "@/components/common/match-calendar"
import { MatchCalendarToolbar } from "@/components/common/match-calendar-toolbar"
import { useOrganizationMatches } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { rangeOf, type CalendarViewName } from "@/lib/match-range"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { MatchFormDialog } from "./_components/match-form-dialog"
import { MatchList } from "./_components/match-list"
import { MatchRescheduleDialog } from "./_components/match-reschedule-dialog"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang quản lý lịch thi đấu của tổ chức.
 *
 *         Trang giữ MỘT kỳ đang xem (mốc neo + kiểu xem) và suy ra mọi thứ từ đó: khoảng gửi
 *         lên BE, tiêu đề, phạm vi của bộ lịch, và phạm vi của danh sách. Bộ lịch là thành
 *         phần ĐƯỢC ĐIỀU KHIỂN chứ không tự giữ kỳ của nó — nhờ vậy một thanh lọc duy nhất
 *         lái được cả hai cách xem, thay vì cách xem nào cũng phải có bộ lọc riêng.
 *
 *         Bộ lịch và danh sách đều không có viền: chúng là hai cách đọc cùng một dữ liệu, đổi
 *         qua lại mà một bên có khung một bên không thì mỗi lần đổi là một lần giao diện nhảy.
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
  const [view, setView] = useState<CalendarViewName>("timeGridWeek")
  const [mode, setMode] = useState<"calendar" | "list">("calendar")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialStart, setInitialStart] = useState<Date | undefined>(undefined)
  const [initialEnd, setInitialEnd] = useState<Date | null>(null)
  const [moveRequest, setMoveRequest] = useState<MatchMoveRequest | null>(null)

  const range = useMemo(() => rangeOf(anchor, view), [anchor, view])
  const { data: matches, isFetching } = useOrganizationMatches(organization.id, range)

  // Trận đã huỷ không hiện trên lịch lẫn danh sách: nó không còn là một buổi để đi, và một ô
  // trông y hệt các ô khác mà thực ra đã huỷ thì tệ hơn hẳn một ô trống. Lịch sử của nó vẫn
  // nằm ở BE (huỷ là huỷ mềm), chỉ là không chiếm chỗ trên lưới nữa.
  const visibleMatches = useMemo(
    () => (matches ?? []).filter((match) => match.status !== "canceled"),
    [matches],
  )

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
      setMoveRequest(null)
    },
    [moveRequest],
  )

  // Cùng một bộ nút cho cả hai cách xem, khai một lần: hai chỗ tự dựng lại là hai chỗ sẽ trôi
  // mỗi cái một kiểu.
  const actions = (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="icon"
        aria-label={mode === "calendar" ? "Xem dạng danh sách" : "Xem dạng lịch"}
        onClick={() => setMode(mode === "calendar" ? "list" : "calendar")}
      >
        {mode === "calendar" ? (
          <List className="size-4" aria-hidden="true" />
        ) : (
          <CalendarDays className="size-4" aria-hidden="true" />
        )}
      </Button>

      {isOwner ? (
        <Button type="button" onClick={() => openCreate()}>
          <Plus aria-hidden="true" />
          Tạo lịch
        </Button>
      ) : null}
    </div>
  )

  return (
    <main className="flex min-h-0 w-full flex-1 flex-col px-4 py-4 sm:px-6">
      <MatchCalendarToolbar
        anchor={anchor}
        view={view}
        loading={isFetching}
        onAnchorChange={setAnchor}
        onViewChange={setView}
        actions={actions}
      />

      {mode === "calendar" ? (
        <MatchCalendar
          matches={visibleMatches}
          organizationId={organization.id}
          anchor={anchor}
          view={view}
          editable={isOwner}
          onSelectMatch={(matchId) => router.push(`/orgs/${organization.id}/matches/${matchId}`)}
          onCreateAt={isOwner ? ({ start, end }) => openCreate(start, end) : undefined}
          onMove={isOwner ? setMoveRequest : undefined}
        />
      ) : (
        <div className="min-h-0 flex-1 overflow-y-auto">
          <MatchList matches={visibleMatches} organizationId={organization.id} />
        </div>
      )}

      {isOwner ? (
        <>
          <MatchFormDialog
            organizationId={organization.id}
            open={dialogOpen}
            onOpenChange={setDialogOpen}
            initialStart={initialStart}
            initialEnd={initialEnd}
          />
          <MatchRescheduleDialog
            organizationId={organization.id}
            request={moveRequest}
            onClose={closeMove}
          />
        </>
      ) : null}
    </main>
  )
}
