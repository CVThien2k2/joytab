import { SwitchAccountClient } from "./_components/switch-account-client"

/**
 * Input: searchParams.reason (expired | revoked) — chỉ đọc param routing, không fetch ở server.
 * Output: Trang public chọn/đổi tài khoản khi hết phiên. Toàn bộ dữ liệu (accounts) lấy CSR.
 */
export default async function SwitchAccountPage({
  searchParams,
}: {
  searchParams: Promise<{ reason?: string }>
}) {
  const { reason } = await searchParams
  return <SwitchAccountClient reason={reason} />
}
