"use client"

import { MapPin, Plus, Users } from "lucide-react"
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
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useCreateEvent, useEvents } from "@/hooks/use-events"
import { useOrganization } from "@/hooks/use-organizations"
import { formatEventRange, formatMoney } from "@/lib/format"
import type { EventStatus } from "@/types/event"
import { EventFormDialog } from "./event-form-dialog"
import { EventStatusBadge } from "./event-status-badge"

/** Tab "Tất cả" không gửi filter status lên BE. */
type StatusFilter = EventStatus | "ALL"

const TABS: { value: StatusFilter; label: string }[] = [
  { value: "OPEN", label: "Đang mở" },
  { value: "COMPLETED", label: "Đã chốt sổ" },
  { value: "CANCELLED", label: "Đã huỷ" },
  { value: "ALL", label: "Tất cả" },
]

/**
 * Input: orgId.
 * Output: Danh sách buổi đánh theo trạng thái + nút tạo buổi lẻ (ADMIN).
 */
export function EventsPanel({ orgId }: { orgId: string }) {
  const [status, setStatus] = useState<StatusFilter>("OPEN")
  const [dialogOpen, setDialogOpen] = useState(false)
  const filters = status === "ALL" ? {} : { status }
  const { data, isPending } = useEvents(orgId, filters)
  const { data: organization } = useOrganization(orgId)
  const createEvent = useCreateEvent(orgId)
  const isAdmin = organization?.myRole === "ADMIN"

  return (
    <Card>
      <CardHeader>
        <CardTitle>Buổi đánh</CardTitle>
        <CardDescription>
          {data ? `${data.total} buổi` : "Đang tải…"}
        </CardDescription>
        {isAdmin ? (
          <CardAction>
            <Button onClick={() => setDialogOpen(true)}>
              <Plus className="size-4" />
              Tạo buổi đánh
            </Button>
          </CardAction>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        <Tabs value={status} onValueChange={(value) => setStatus(value as StatusFilter)}>
          <TabsList>
            {TABS.map((tab) => (
              <TabsTrigger key={tab.value} value={tab.value}>
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {isPending ? (
          <div className="space-y-2">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : data && data.items.length > 0 ? (
          <div className="grid gap-3">
            {data.items.map((event) => (
              <Link key={event.id} href={`/orgs/${orgId}/events/${event.id}`}>
                <Card className="hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-base">{event.title}</CardTitle>
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
                      <span>{formatMoney(event.totalCost)}</span>
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
            Không có buổi đánh nào ở trạng thái này.
          </p>
        )}
      </CardContent>

      <EventFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        isPending={createEvent.isPending}
        onSubmit={(input) =>
          createEvent.mutate(input, { onSuccess: () => setDialogOpen(false) })
        }
      />
    </Card>
  )
}
