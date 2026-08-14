"use client"

import { use } from "react"
import { EventDetailView } from "./_components/event-detail"

/**
 * Input: `params.orgId` và `params.eventId`.
 * Output: Màn chi tiết buổi đánh.
 */
export default function EventDetailPage({
  params,
}: {
  params: Promise<{ orgId: string; eventId: string }>
}) {
  const { orgId, eventId } = use(params)

  return <EventDetailView orgId={orgId} eventId={eventId} />
}
