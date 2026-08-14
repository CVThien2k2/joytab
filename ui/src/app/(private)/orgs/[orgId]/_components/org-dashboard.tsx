"use client"

import { CalendarDays, LogOut, MapPin, Users, Wallet } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useMyDebts } from "@/hooks/use-billing"
import { useEvents } from "@/hooks/use-events"
import { useLeaveOrganization, useOrganization } from "@/hooks/use-organizations"
import { formatEventRange, formatMoney } from "@/lib/format"
import { EventStatusBadge } from "../events/_components/event-status-badge"

/** Chỉ hiện vài buổi gần nhất; xem đủ thì sang màn "Buổi đánh". */
const UPCOMING_LIMIT = 5

/**
 * Input: orgId.
 * Output: Trang tổng quan của nhóm — trận sắp tới + công nợ của tôi.
 */
export function OrgDashboard({ orgId }: { orgId: string }) {
  const { data: organization } = useOrganization(orgId)
  const { data: events, isPending: eventsPending } = useEvents(orgId, {
    status: "OPEN",
    from: new Date().toISOString(),
    pageSize: UPCOMING_LIMIT,
  })
  const { data: debts, isPending: debtsPending } = useMyDebts(orgId)
  const leaveOrganization = useLeaveOrganization(orgId)
  const [leaveOpen, setLeaveOpen] = useState(false)

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Users className="size-3.5" />
              Thành viên
            </CardDescription>
            <CardTitle className="text-2xl">
              {organization?.memberCount ?? "—"}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <CalendarDays className="size-3.5" />
              Buổi sắp tới
            </CardDescription>
            <CardTitle className="text-2xl">{events?.total ?? "—"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1">
              <Wallet className="size-3.5" />
              Tôi còn nợ
            </CardDescription>
            <CardTitle className="text-2xl">
              {debts ? formatMoney(debts.remaining) : "—"}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Buổi đánh sắp tới</CardTitle>
          <CardDescription>Bấm vào một buổi để bình chọn.</CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orgs/${orgId}/events`}>Xem tất cả</Link>
            </Button>
          </CardAction>
        </CardHeader>
        <CardContent>
          {eventsPending ? (
            <Skeleton className="h-32 w-full" />
          ) : events && events.items.length > 0 ? (
            <div className="grid gap-3">
              {events.items.map((event) => (
                <Link key={event.id} href={`/orgs/${orgId}/events/${event.id}`}>
                  <Card className="hover:border-primary transition-colors">
                    <CardHeader>
                      <CardTitle className="text-base">{event.title}</CardTitle>
                      <CardDescription className="flex flex-wrap items-center gap-x-3">
                        <span>{formatEventRange(event.startAt, event.endAt)}</span>
                        {event.locationName ? (
                          <span className="flex items-center gap-1">
                            <MapPin className="size-3.5" />
                            {event.locationName}
                          </span>
                        ) : null}
                        <span className="flex items-center gap-1">
                          <Users className="size-3.5" />
                          {event.goingCount}/{event.maxParticipants}
                        </span>
                      </CardDescription>
                      <CardAction>
                        <EventStatusBadge status={event.status} />
                      </CardAction>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">
              Chưa có buổi nào sắp tới.
              {organization?.myRole === "ADMIN"
                ? " Tạo lịch định kỳ để hệ thống tự sinh buổi hằng tuần."
                : null}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Công nợ của tôi</CardTitle>
          <CardDescription>
            {debtsPending
              ? "Đang tải…"
              : debts && debts.remaining > 0
                ? `Còn nợ ${formatMoney(debts.remaining)} trong nhóm này`
                : "Bạn không còn nợ khoản nào"}
          </CardDescription>
          <CardAction>
            <Button asChild variant="outline" size="sm">
              <Link href={`/orgs/${orgId}/debts`}>Xem chi tiết</Link>
            </Button>
          </CardAction>
        </CardHeader>
      </Card>

      <AlertDialog open={leaveOpen} onOpenChange={setLeaveOpen}>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="sm" className="text-destructive">
            <LogOut className="size-4" />
            Rời nhóm
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Rời nhóm này?</AlertDialogTitle>
            <AlertDialogDescription>
              Bạn sẽ không xem được lịch đánh nữa. Công nợ cũ vẫn được giữ nguyên và
              bạn có thể quay lại bằng link mời mới.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Ở lại</AlertDialogCancel>
            <AlertDialogAction onClick={() => leaveOrganization.mutate()}>
              Rời nhóm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
