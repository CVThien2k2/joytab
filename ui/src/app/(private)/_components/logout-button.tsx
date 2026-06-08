"use client"

import { Button } from "@/components/ui/button"
import { useLogout } from "@/hooks/use-auth-api"

/**
 * Input: Không nhận props.
 * Output: Nút đăng xuất account đang active (client — gọi mutation useLogout).
 */
export function LogoutButton() {
  const logout = useLogout()
  return (
    <Button
      type="button"
      size="sm"
      variant="destructive"
      disabled={logout.isPending}
      onClick={() => logout.mutate()}
    >
      Đăng xuất
    </Button>
  )
}
