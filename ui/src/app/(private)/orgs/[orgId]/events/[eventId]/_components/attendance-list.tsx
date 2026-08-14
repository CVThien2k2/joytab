"use client"

import { useState } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { useMarkAttended, useSetAttendance } from "@/hooks/use-events"
import { useMembers } from "@/hooks/use-organizations"
import type { Attendance, EventDetail } from "@/types/event"

/**
 * Input: Một dòng bình chọn.
 * Output: Hai chữ cái làm avatar dự phòng.
 */
function getInitials(attendance: Attendance): string {
  return (attendance.fullName ?? attendance.email).slice(0, 2).toUpperCase()
}

/**
 * Input: Danh sách người bình chọn đi.
 * Output: Map userId → đã có mặt, lấy từ giá trị server (chưa chấm thì coi là chưa có mặt).
 */
function buildAttendedDraft(going: Attendance[]): Record<string, boolean> {
  return Object.fromEntries(going.map((item) => [item.userId, item.attended ?? false]))
}

type AttendanceListProps = {
  orgId: string
  event: EventDetail
}

/**
 * Input: orgId và chi tiết buổi đánh.
 * Output: Danh sách người đã bình chọn; ADMIN thêm được cột chấm thực tế có mặt và thêm
 *         người chưa bình chọn vào danh sách đi.
 *
 * Cột `attended` gom lại rồi lưu một lần bằng nút "Lưu điểm danh": chấm từng người một lượt
 * request là vô nghĩa khi admin ngồi tick cả sân.
 */
export function AttendanceList({ orgId, event }: AttendanceListProps) {
  const isAdmin = event.myRole === "ADMIN"
  const canEdit = isAdmin && event.status === "OPEN"
  const markAttended = useMarkAttended(event.id)
  const setAttendance = useSetAttendance(event.id)
  const { data: members } = useMembers(orgId)

  const going = event.attendances.filter((item) => item.status === "GOING")
  const notGoing = event.attendances.filter((item) => item.status === "NOT_GOING")

  // Nháp điểm danh, kèm chính mảng đã dựng ra nó để biết khi nào cần dựng lại.
  const [draft, setDraft] = useState<{
    source: Attendance[]
    values: Record<string, boolean>
  }>(() => ({ source: event.attendances, values: buildAttendedDraft(going) }))

  // Dữ liệu server đổi (có người vừa vote, vừa lưu điểm danh xong) thì dựng lại nháp.
  // Đặt trong render chứ không trong useEffect: setState ngay trong effect gây thêm một
  // vòng render thừa, còn React xử lý setState-khi-đang-render bằng cách render lại luôn
  // trước khi vẽ ra màn hình.
  if (draft.source !== event.attendances) {
    setDraft({ source: event.attendances, values: buildAttendedDraft(going) })
  }
  const attendedDraft = draft.values

  const notVoted =
    members?.filter(
      (member) =>
        !event.attendances.some((item) => item.userId === member.userId),
    ) ?? []

  return (
    <Card>
      <CardHeader>
        <CardTitle>Danh sách bình chọn</CardTitle>
        <CardDescription>
          {going.length}/{event.maxParticipants} người đi · {notGoing.length} người bận
        </CardDescription>
        {canEdit ? (
          <CardAction>
            <Button
              variant="secondary"
              disabled={markAttended.isPending || going.length === 0}
              onClick={() =>
                markAttended.mutate(
                  going.map((item) => ({
                    userId: item.userId,
                    attended: attendedDraft[item.userId] ?? false,
                  })),
                )
              }
            >
              Lưu điểm danh
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-6">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Người chơi</TableHead>
              <TableHead>Bình chọn</TableHead>
              {canEdit ? <TableHead className="w-32">Thực tế có mặt</TableHead> : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...going, ...notGoing].map((attendance) => (
              <TableRow key={attendance.userId}>
                <TableCell>
                  <div className="flex items-center gap-3">
                    <Avatar className="size-8">
                      {attendance.avatarUrl ? (
                        <AvatarImage src={attendance.avatarUrl} alt="" />
                      ) : null}
                      <AvatarFallback>{getInitials(attendance)}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {attendance.fullName ?? attendance.email}
                      </p>
                      <p className="text-muted-foreground truncate text-xs">
                        {attendance.email}
                      </p>
                    </div>
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      attendance.status === "GOING" ? "default" : "secondary"
                    }
                  >
                    {attendance.status === "GOING" ? "Đi" : "Bận"}
                  </Badge>
                </TableCell>
                {canEdit ? (
                  <TableCell>
                    {attendance.status === "GOING" ? (
                      <Switch
                        checked={attendedDraft[attendance.userId] ?? false}
                        onCheckedChange={(checked) =>
                          setDraft((current) => ({
                            ...current,
                            values: {
                              ...current.values,
                              [attendance.userId]: checked,
                            },
                          }))
                        }
                      />
                    ) : (
                      <span className="text-muted-foreground text-sm">—</span>
                    )}
                  </TableCell>
                ) : null}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {canEdit && notVoted.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Chưa bình chọn</p>
            <div className="flex flex-wrap gap-2">
              {notVoted.map((member) => (
                <Button
                  key={member.userId}
                  size="sm"
                  variant="outline"
                  disabled={setAttendance.isPending || event.isFull}
                  onClick={() =>
                    setAttendance.mutate({ userId: member.userId, status: "GOING" })
                  }
                >
                  + {member.fullName ?? member.email}
                </Button>
              ))}
            </div>
            <p className="text-muted-foreground text-xs">
              Thêm hộ người tới sân mà quên bình chọn. Vẫn tôn trọng sĩ số tối đa.
            </p>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
