"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { logout } from "@/api/auth"

// Thông báo theo lý do — hiển thị bằng toast (không nhét vào URL/DOM lâu dài).
const REASON_MESSAGES: Record<string, string> = {
  expired: "Phiên đăng nhập đã hết hạn.",
  revoked: "Phiên của bạn đã bị thu hồi.",
}

/**
 * Input: reason (từ ?reason ở server). Chạy 1 lần khi vào /switch-account.
 * Output: side-effect lúc tới trang:
 *  1. Gọi logout (raw) để BE xoá cookie session_id chết (giữ device_id).
 *  2. Toast thông báo lý do hết phiên.
 *  3. replace URL bỏ ?reason (sạch lịch sử, reload/back không lặp lại).
 */
export function ExpiredNotice({ reason }: { reason?: string }) {
  const router = useRouter()
  const doneRef = useRef(false)

  useEffect(() => {
    if (doneRef.current || !reason) {
      return
    }
    doneRef.current = true
    void logout().catch(() => {})
    toast.info(REASON_MESSAGES[reason] ?? "Phiên đăng nhập đã kết thúc.")
    router.replace("/switch-account")
  }, [reason, router])

  return null
}
