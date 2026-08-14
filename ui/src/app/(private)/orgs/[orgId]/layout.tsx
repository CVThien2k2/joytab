import type { ReactNode } from "react"
import { OrgShell } from "./_components/org-shell"

/**
 * Input: `params.orgId` và nội dung route con.
 * Output: Mọi màn hình trong một nhóm đều nằm trong khung sidebar + breadcrumb.
 */
export default function OrgLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ orgId: string }>
}) {
  return <OrgShell params={params}>{children}</OrgShell>
}
