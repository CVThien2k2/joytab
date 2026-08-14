"use client"

import { ArrowLeft, MapPin, Pencil, Users } from "lucide-react"
import Link from "next/link"
import { useState } from "react"
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
import {
  useCancelEvent,
  useEvent,
  useReopenEvent,
  useUpdateEvent,
} from "@/hooks/use-events"
import { formatDateTime, formatEventRange, formatMoney } from "@/lib/format"
import { EventFormDialog } from "../../_components/event-form-dialog"
import { EventStatusBadge } from "../../_components/event-status-badge"
import { AttendanceList } from "./attendance-list"
import { FinalizeDialog } from "./finalize-dialog"
import { VoteButtons } from "./vote-buttons"

type EventDetailProps = {
  orgId: string
  eventId: string
}

/**
 * Input: orgId và eventId.
 * Output: Toàn bộ màn chi tiết — bình chọn, danh sách người đi, chấm điểm danh, chốt sổ.
 */
export function EventDetailView({ orgId, eventId }: EventDetailProps) {
  const { data: event, isPending, isError } = useEvent(eventId)
  const updateEvent = useUpdateEvent(eventId, orgId)
  const cancelEvent = useCancelEvent(eventId, orgId)
  const reopenEvent = useReopenEvent(eventId, orgId)
  const [editOpen, setEditOpen] = useState(false)
  const [finalizeOpen, setFinalizeOpen] = useState(false)

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (isError) {
    return (
      <p className="text-destructive text-sm">
        Không tải được buổi đánh này. Có thể nó đã bị xoá.
      </p>
    )
  }

  const isAdmin = event.myRole === "ADMIN"

  return (
    <div className="space-y-6">
      <Button asChild variant="ghost" size="sm">
        <Link href={`/orgs/${orgId}/events`}>
          <ArrowLeft className="size-4" />
          Danh sách buổi đánh
        </Link>
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{event.title}</CardTitle>
          <CardDescription className="flex flex-wrap items-center gap-x-3 gap-y-1">
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
          <CardAction className="flex items-center gap-2">
            <EventStatusBadge status={event.status} />
            {isAdmin && event.status === "OPEN" ? (
              <Button
                size="icon"
                variant="ghost"
                aria-label="Sửa buổi đánh"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="size-4" />
              </Button>
            ) : null}
          </CardAction>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="text-sm">
            <p>
              Tổng chi phí:{" "}
              <span className="font-medium">{formatMoney(event.totalCost)}</span>
              <span className="text-muted-foreground">
                {" "}
                (sân {formatMoney(event.courtCost)}
                {event.extraCosts.map(
                  (cost) => ` + ${cost.name} ${formatMoney(cost.amount)}`,
                )}
                )
              </span>
            </p>
            <p className="text-muted-foreground">
              Khoá bình chọn lúc {formatDateTime(event.voteLockedAt)}
            </p>
          </div>

          <VoteButtons event={event} />

          {isAdmin ? (
            <div className="flex flex-wrap gap-2 border-t pt-4">
              {event.status === "OPEN" ? (
                <>
                  <Button onClick={() => setFinalizeOpen(true)}>
                    Chốt sổ và chia tiền
                  </Button>
                  <Button
                    variant="outline"
                    disabled={cancelEvent.isPending}
                    onClick={() => cancelEvent.mutate()}
                  >
                    Huỷ buổi đánh
                  </Button>
                </>
              ) : null}
              {event.status === "COMPLETED" ? (
                <Button
                  variant="outline"
                  disabled={reopenEvent.isPending}
                  onClick={() => reopenEvent.mutate()}
                >
                  Mở lại để sửa
                </Button>
              ) : null}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <AttendanceList orgId={orgId} event={event} />

      <EventFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        event={event}
        isPending={updateEvent.isPending}
        onSubmit={(input) =>
          updateEvent.mutate(input, { onSuccess: () => setEditOpen(false) })
        }
      />

      <FinalizeDialog
        open={finalizeOpen}
        onOpenChange={setFinalizeOpen}
        orgId={orgId}
        event={event}
      />
    </div>
  )
}
