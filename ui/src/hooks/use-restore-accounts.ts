"use client"

import { useEffect, useRef } from "react"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận tham số; chạy 1 lần lúc mount client.
 * Output: Bảo đảm có active account mặc định sau khi hydrate store; không refresh nếu token persisted còn dùng được.
 */
export function useRestoreAccounts() {
  const ranRef = useRef(false)
  useEffect(() => {
    if (ranRef.current) return
    ranRef.current = true
    const { accounts, activeAccountId, setActiveAccount } = useAuthStore.getState()
    const targetId = activeAccountId && accounts[activeAccountId] ? activeAccountId : Object.keys(accounts)[0]
    if (!targetId) return
    if (activeAccountId !== targetId) setActiveAccount(targetId)
  }, [])
}
