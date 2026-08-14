import type { Metadata } from "next"
import { InviteCard } from "./_components/invite-card"

export const metadata: Metadata = {
  title: "Lời mời tham gia nhóm",
  robots: { index: false, follow: false },
}

/**
 * Input: `params.token` — token thô trong link mời.
 * Output: Trang public xem trước lời mời. Người chưa đăng nhập vẫn thấy được tên nhóm trước
 *         khi quyết định đăng nhập.
 */
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params

  return <InviteCard token={token} />
}
