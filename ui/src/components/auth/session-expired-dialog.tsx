"use client"

import { useEffect } from "react"
import { toast } from "sonner"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { LogoutButton } from "@/components/auth/logout-button"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận props; đọc store (đã hydrate từ server).
 * Output: Popup "đã hết phiên đăng nhập" (không đóng được) + nút đăng xuất.
 *         Tự render khi `!user && hasSessionCookie` (còn cookie nhưng session hỏng); ngược lại null.
 *         Đặt global ở AuthProvider nên áp dụng cho toàn app.
 */
export function SessionExpiredDialog() {
  const expired = useAuthStore((state) => !state.user && state.hasSessionCookie)

  useEffect(() => {
    if (expired) {
      toast.error("Phiên đăng nhập đã hết hạn")
    }
  }, [expired])

  if (!expired) {
    return null
  }

  return (
    <Dialog open>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Hết phiên đăng nhập</DialogTitle>
          <DialogDescription>
            Phiên của bạn đã hết hạn hoặc bị thu hồi. Vui lòng đăng xuất để đăng nhập lại.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <LogoutButton />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
