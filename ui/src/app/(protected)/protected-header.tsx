"use client"

import { useMutation } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { apiClient } from "@/lib/api-client"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; đọc user info từ Zustand store và gọi BE logout khi nhấn nút.
 * Output: Render header có email người dùng và nút đăng xuất; sau logout redirect về `/login`.
 */
export function ProtectedHeader() {
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const clearUser = useAuthStore((state) => state.clearUser)

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await apiClient.post("/auth/logout")
    },
    onSettled: () => {
      clearUser()
      router.replace("/login")
      router.refresh()
    },
  })

  return (
    <header className="flex items-center justify-between border-b border-zinc-200 bg-white px-6 py-3">
      <span className="text-base font-semibold text-zinc-900">Joytab</span>
      <div className="flex items-center gap-3">
        <span className="text-sm text-zinc-600">{user?.email ?? ""}</span>
        <Button
          type="button"
          size="sm"
          onClick={() => logoutMutation.mutate()}
          disabled={logoutMutation.isPending}
        >
          {logoutMutation.isPending ? "Đang đăng xuất..." : "Đăng xuất"}
        </Button>
      </div>
    </header>
  )
}
