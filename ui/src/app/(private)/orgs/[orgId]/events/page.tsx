"use client"

import { use } from "react"
import { EventsPanel } from "./_components/events-panel"

/**
 * Input: `params.orgId`.
 * Output: Danh sách buổi đánh của nhóm.
 */
export default function EventsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return <EventsPanel orgId={orgId} />
}
