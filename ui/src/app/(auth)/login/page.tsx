"use client"

import { Button } from "@/components/ui/button"
import { redirectToGoogleLogin } from "@/lib/google-login"

/**
 * Input: Không nhận tham số; đọc trạng thái đăng nhập từ Zustand store.
 * Output: Render màn hình login Google hoặc điều hướng về `/` khi đã login.
 */
export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6">
      <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-zinc-900">Joytab Login</h1>
        <p className="mt-2 text-sm text-zinc-600">
          Đăng nhập bằng Google để tiếp tục.
        </p>
        <Button
          type="button"
          onClick={() => redirectToGoogleLogin()}
          className="mt-6 w-full"
        >
          Đăng nhập với Google
        </Button>
      </div>
    </main>
  )
}
