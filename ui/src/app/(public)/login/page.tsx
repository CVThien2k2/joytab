"use client"

import { Button } from "@/components/ui/button"

/**
 * Input: Không nhận input.
 * Output: Điều hướng browser sang `/auth/google` cùng origin để Next proxy chuyển tiếp sang BE.
 */
function handleGoogleLogin() {
  window.location.href = "/auth/google"
}

/**
 * Input: Không nhận tham số.
 * Output: Render màn hình login Google; điều hướng theo session do middleware xử lý.
 */
export default function LoginPage() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h1 className="text-xl font-semibold text-zinc-900">Joytab Login</h1>
      <p className="mt-2 text-sm text-zinc-600">Đăng nhập bằng Google để tiếp tục.</p>
      <Button type="button" onClick={handleGoogleLogin} className="mt-6 w-full">
        Đăng nhập với Google
      </Button>
    </div>
  )
}
