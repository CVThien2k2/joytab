"use client"

import { logout } from "@/api/auth"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

/**
 * Input: open — hiện khi /auth/me trả mã AUTH_004 (phiên bị thu hồi).
 * Output: Popup không cho đóng + nút "Đăng nhập lại" (logout dọn cookie → /login).
 */
export function SessionRevokedDialog({ open }: { open: boolean }) {
  const handleRelogin = () => {
    void logout().catch(() => {})
    window.location.href = "/login"
  }

  return (
    <Dialog open={open}>
      <DialogContent
        showCloseButton={false}
        onEscapeKeyDown={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle>Phiên đã bị thu hồi</DialogTitle>
          <DialogDescription>
            Phiên đăng nhập của bạn đã bị thu hồi. Vui lòng đăng nhập lại.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" onClick={handleRelogin}>
            Đăng nhập lại
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
