"use client"

import { use } from "react"
import { PaymentsPanel } from "./_components/payments-panel"

/**
 * Input: `params.orgId`.
 * Output: Màn duyệt thanh toán + công nợ toàn nhóm (ADMIN).
 */
export default function PaymentsPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return <PaymentsPanel orgId={orgId} />
}
