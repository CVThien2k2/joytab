"use client"

import { use } from "react"
import { TemplatesPanel } from "./_components/templates-panel"

/**
 * Input: `params.orgId`.
 * Output: Màn quản trị lịch định kỳ hằng tuần.
 */
export default function TemplatesPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return <TemplatesPanel orgId={orgId} />
}
