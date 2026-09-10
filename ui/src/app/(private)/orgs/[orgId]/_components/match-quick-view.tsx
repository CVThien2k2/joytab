"use client"

import { CalendarDays, Clock, MapPin, Pencil, StickyNote, Trash2, Users } from "lucide-react"
import { MatchStatusBadge } from "@/components/common/match-status-badge"
import { ParticipantFaces } from "@/components/common/participant-faces"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogIconHeader,
} from "@/components/ui/dialog"
import { useMatch } from "@/hooks/use-matches-api"
import { useNow } from "@/hooks/use-now"
import { formatDayLabel, formatTime } from "@/lib/format"
import { matchPhase } from "@/lib/match-phase"
import type { MatchSummary } from "@/types/match"

/** Một dòng thông tin: icon + nhãn ở trái, nội dung ở phải. */
function Row({
  icon: Icon,
  label,
  children,
}: {
  icon: React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-start gap-3">
      <Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-0.5 text-sm">{children}</div>
      </div>
    </div>
  )
}

/**
 * Input: một buổi (`null` = chưa chọn gì) + quyền của người xem + hai callback của chủ tổ chức.
 * Output: Hộp thoại xem nhanh một buổi: giờ, sân, địa chỉ, người đã đăng ký, ghi chú.
 *
 *         Bấm vào một thẻ trong danh sách mở CÁI NÀY, không rời trang sang `/matches/<id>`:
 *         câu người ta hỏi khi bấm là "buổi này có gì, ai đi" — trả lời xong thì họ còn ở
 *         nguyên chỗ cũ để xem tiếp buổi sau. Trang chi tiết là chỗ khác hẳn: nó có bảng chia
 *         tiền, lịch sử đăng ký, và cả luồng chốt chi phí.
 *
 *         Cụm avatar ở đây dùng danh sách ĐẦY ĐỦ (tải từ API chi tiết trận), nên rê vào viên
 *         "+N" là bung ra tên của tất cả những người còn lại — khác với thẻ ngoài danh sách,
 *         nơi chỉ có 5 người đầu nên viên đó chỉ đếm được số.
 *
 *         CHỈ ĐỌC, trừ hai nút của chủ tổ chức. Nút đăng ký cố tình không có ở đây: nó đã nằm
 *         ngay trên chính cái thẻ vừa bấm, thêm một nút thứ hai cho cùng một việc chỉ khiến
 *         người ta phải chọn xem bấm cái nào.
 *
 *         Hai nút của chủ tổ chức chỉ CHUYỂN TIẾP cú bấm lên trên: hộp thoại sửa và hộp thoại
 *         huỷ sống ở tầng danh sách, vì mở chúng thì hộp thoại này phải đóng lại — hai lớp
 *         dialog chồng nhau là hai lớp nền mờ chồng nhau.
 */
export function MatchQuickView({
  match,
  isOwner,
  open,
  onOpenChange,
  onEdit,
  onCancel,
}: {
  match: MatchSummary | null
  isOwner: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
  onEdit: () => void
  onCancel: () => void
}) {
  // Cả hai hook gọi TRƯỚC nhánh `return null`: hook không được nằm sau một lối thoát sớm.
  const now = useNow()
  // Danh sách người tham gia ĐẦY ĐỦ chỉ có ở API chi tiết trận; `participantsPreview` đi kèm
  // mỗi dòng danh sách chỉ có 5 người đầu. Hỏi khi hộp thoại mở, và chỉ khi mở — đóng rồi thì
  // component này vẫn còn trong cây (giữ trận vừa xem để chạy animation ra).
  //
  // Trong lúc chờ, cụm avatar vẫn vẽ bằng bản xem trước nên không có nhịp trống nào; danh sách
  // đầy đủ về thì viên "+N" đổi từ đếm số sang liệt kê tên.
  const detail = useMatch(match?.id ?? "", open)

  if (!match) return null

  // Sửa và huỷ đều chỉ mở khi trận CHƯA tới giờ và chưa chốt tiền — cùng luật với trang chi
  // tiết, và cũng là luật BE ném ra (MATCH_011 / MATCH_015). Hiện một nút để rồi ăn lỗi thì
  // thà đừng hiện.
  const editable = isOwner && match.status === "open" && matchPhase(match, now) === "upcoming"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogIconHeader
          icon={CalendarDays}
          title={match.courtName}
          description={`${formatDayLabel(match.startAt)} · ${formatTime(match.startAt)} – ${formatTime(match.endAt)}`}
        />

        <DialogBody className="my-4 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <MatchStatusBadge match={match} />
            {match.voted ? <Badge variant="success">Đã đăng ký</Badge> : null}
            {match.voteClosedReason === "full" ? <Badge variant="destructive">Đủ chỗ</Badge> : null}
            {match.myAmount !== null ? (
              <Badge variant={match.myPaymentStatus === "unpaid" ? "destructive" : "success"}>
                {match.myPaymentStatus === "unpaid" ? "Chưa trả" : "Đã trả"}
              </Badge>
            ) : null}
          </div>

          <Row icon={Clock} label="Thời gian">
            <span className="font-mono tabular-nums">
              {formatDayLabel(match.startAt)} · {formatTime(match.startAt)} –{" "}
              {formatTime(match.endAt)}
            </span>
          </Row>

          {/* Địa chỉ chỉ hiện khi có: trận tạo trước khi app có ô này thì để trống, mà một dòng
              trống kèm icon ghim còn khó hiểu hơn là không có dòng nào. */}
          {match.address ? (
            <Row icon={MapPin} label="Địa chỉ">
              {match.address}
            </Row>
          ) : null}

          <Row icon={Users} label="Người tham gia">
            <div className="flex flex-wrap items-center gap-3">
              {/* Nền hộp thoại khác nền thẻ, nên viền quanh mỗi avatar phải đổi theo — xem
                  `ringClass` ở ParticipantFaces. */}
              <ParticipantFaces
                participants={detail.data?.participants ?? match.participantsPreview}
                total={detail.data?.playerCount ?? match.playerCount}
                ringClass="ring-background"
              />
              <span className="font-mono text-sm tabular-nums">
                {detail.data?.playerCount ?? match.playerCount}/{match.maxPlayers}
              </span>
            </div>
          </Row>

          {match.note ? (
            <Row icon={StickyNote} label="Ghi chú">
              <p className="whitespace-pre-line">{match.note}</p>
            </Row>
          ) : null}
        </DialogBody>

        <DialogFooter showCloseButton>
          {editable ? (
            <>
              <Button type="button" variant="outline" onClick={onEdit}>
                <Pencil aria-hidden="true" />
                Sửa
              </Button>
              <Button type="button" variant="destructive" onClick={onCancel}>
                <Trash2 aria-hidden="true" />
                Huỷ trận
              </Button>
            </>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
