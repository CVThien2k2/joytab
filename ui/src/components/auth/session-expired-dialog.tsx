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
 * Output: Popup "đã hết phiên đăng nhập" (không đóng được) + nút đăng xuất khi `isExpired`.
 *         `isError` → toast lỗi (không chặn). Đặt global ở AuthProvider nên áp dụng cho toàn app.
 */
export function SessionExpiredDialog() {
  const isExpired = useAuthStore((state) => state.isExpired)
  const isError = useAuthStore((state) => state.isError)

  useEffect(() => {
    if (isExpired) {
      toast.error("Phiên đăng nhập đã hết hạn")
    }
  }, [isExpired])

  useEffect(() => {
    if (isError) {
      toast.error("Không tải được phiên đăng nhập. Vui lòng thử lại.")
    }
  }, [isError])

  if (!isExpired) {
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
