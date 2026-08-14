"use client"

import { use } from "react"
import { OrgDashboard } from "./_components/org-dashboard"

/**
 * Input: `params.orgId`.
 * Output: Trang tổng quan của nhóm.
 */
export default function OrgPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return <OrgDashboard orgId={orgId} />
}
