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
import { LogoutButton } from "./logout-button"

/**
 * Input: Không nhận props.
 * Output: Popup "đã hết phiên đăng nhập" (không đóng được) + nút đăng xuất.
 *         Render khi còn cookie nhưng /auth/me không lấy được user (session hỏng).
 */
export function SessionExpiredDialog() {
  useEffect(() => {
    toast.error("Phiên đăng nhập đã hết hạn")
  }, [])

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
