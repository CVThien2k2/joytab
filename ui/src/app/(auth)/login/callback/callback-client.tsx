"use client"

import { useMutation } from "@tanstack/react-query"
import { useEffect, useRef } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { apiClient } from "@/lib/api-client"
import {
  parseGoogleLoginCallbackCode,
  parseGoogleLoginExchangeResponse,
} from "@/lib/auth-callback"
import { getDeviceFingerprint } from "@/lib/device"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Callback code từ query string do BE redirect về sau OAuth Google.
 * Output: Gọi BE để đổi code lấy token + user, lưu vào store và điều hướng về `/`.
 */
export function GoogleAuthCallbackClient() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const addAccount = useAuthStore((state) => state.addAccount)
  const hasRequestedRef = useRef(false)
  const callbackCode = parseGoogleLoginCallbackCode(searchParams.toString())

  const exchangeGoogleCodeMutation = useMutation({
    mutationFn: async (code: string) => {
      const deviceFingerprint = await getDeviceFingerprint()
      const response = await apiClient.post(
        "/auth/google/exchange",
        { code, deviceFingerprint },
        { withCredentials: true },
      )
      const parsedSession = parseGoogleLoginExchangeResponse(response.data)
      if (!parsedSession) {
        throw new Error("Invalid exchange response")
      }

      return parsedSession
    },
    onSuccess: (session) => {
      addAccount(session)
      router.replace("/")
    },
    onError: () => {
      router.replace("/login")
    },
  })

  useEffect(() => {
    if (hasRequestedRef.current) {
      return
    }
    hasRequestedRef.current = true

    if (!callbackCode) {
      router.replace("/login")
      return
    }

    exchangeGoogleCodeMutation.mutate(callbackCode)
  }, [callbackCode, exchangeGoogleCodeMutation, router])

  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 text-sm text-zinc-700 shadow-sm">
        Đang xác thực đăng nhập Google...
      </div>
    </main>
  )
}
