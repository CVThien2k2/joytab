"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import { CalendarDays, List, Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MatchCalendar, type CalendarRange } from "@/components/common/match-calendar"
import { useOrganizationMatches, useUpdateMatch } from "@/hooks/use-matches-api"
import { useActiveOrganization } from "@/providers/organization-store-provider"
import { MatchFormDialog } from "./_components/match-form-dialog"
import { MatchList } from "./_components/match-list"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang quản lý lịch thi đấu của tổ chức.
 *
 *         Bộ lịch là giao diện chính vì câu hỏi thường trực là "tuần này có buổi nào", mà đó
 *         là câu hỏi về thời gian. Vẫn có nút chuyển sang danh sách cho ai cần quét nhanh
 *         trạng thái từng trận.
 *
 *         Owner có thêm hai thao tác ngay trên lịch: quét chọn một khoảng để tạo, và kéo thả
 *         để dời. Kéo thả đổi giao diện TRƯỚC khi server trả lời, nên khi hỏng phải gọi
 *         `revert()` của FullCalendar — để nguyên là màn hình đang nói dối.
 */
export default function OrganizationMatchesPage() {
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"

  const [range, setRange] = useState<CalendarRange | undefined>(undefined)
  const [mode, setMode] = useState<"calendar" | "list">("calendar")
  const [dialogOpen, setDialogOpen] = useState(false)
  const [initialStart, setInitialStart] = useState<Date | undefined>(undefined)
  const [initialEnd, setInitialEnd] = useState<Date | null>(null)

  const { data: matches, isFetching } = useOrganizationMatches(organization.id, range)
  const updateMatch = useUpdateMatch(organization.id)

  // Lịch báo lại khoảng ngày sau mỗi lần render của nó — so trước rồi mới set, nếu không thì
  // mỗi lần fetch xong lại kích hoạt một lần fetch nữa.
  const handleRangeChange = useCallback((next: CalendarRange) => {
    setRange((current) =>
      current && current.from === next.from && current.to === next.to ? current : next,
    )
  }, [])

  const openCreate = useCallback((start?: Date, end?: Date | null) => {
    setInitialStart(start)
    setInitialEnd(end ?? null)
    setDialogOpen(true)
  }, [])

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-base font-semibold tracking-tight">Lịch thi đấu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {isOwner
              ? "Quét chọn một khoảng trống để tạo lịch, kéo thả để dời."
              : "Bấm một trận để xem chi tiết và đăng ký tham gia."}
          </p>
        </div>

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
      </div>

      {mode === "calendar" ? (
        <MatchCalendar
          matches={matches ?? []}
          loading={isFetching}
          editable={isOwner}
          onRangeChange={handleRangeChange}
          onSelectMatch={(matchId) =>
            router.push(`/orgs/${organization.id}/matches/${matchId}`)
          }
          onCreateAt={isOwner ? ({ start, end }) => openCreate(start, end) : undefined}
          onMove={({ matchId, startAt, endAt, revert }) =>
            updateMatch.mutate(
              { matchId, payload: { startAt, endAt } },
              // Server từ chối (trận đã chốt tiền, giờ không hợp lệ) thì chip phải nhảy về
              // đúng chỗ cũ. Toast lỗi do chính hook lo.
              { onError: revert },
            )
          }
        />
      ) : (
        <MatchList matches={matches ?? []} organizationId={organization.id} />
      )}

      {isOwner ? (
        <MatchFormDialog
          organizationId={organization.id}
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          initialStart={initialStart}
          initialEnd={initialEnd}
        />
      ) : null}
    </main>
  )
}
