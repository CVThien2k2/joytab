"use client"

import { use } from "react"
import { MyDebtsPanel } from "./_components/my-debts-panel"

/**
 * Input: `params.orgId`.
 * Output: Màn công nợ của tôi trong nhóm.
 */
export default function DebtsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return <MyDebtsPanel orgId={orgId} />
}
