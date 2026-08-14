"use client"

import { use } from "react"
import { InvitePanel } from "./_components/invite-panel"
import { MembersPanel } from "./_components/members-panel"

/**
 * Input: `params.orgId`.
 * Output: Màn quản trị thành viên — danh sách người trong nhóm + link mời.
 */
export default function MembersPage({
  params,
}: {
  params: Promise<{ orgId: string }>
}) {
  const { orgId } = use(params)

  return (
    <div className="space-y-6">
      <MembersPanel orgId={orgId} />
      <InvitePanel orgId={orgId} />
    </div>
  )
}
