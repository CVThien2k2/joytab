"use client"

import Image from "next/image"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { cn } from "@/lib/utils"
import { redirectToGoogleLogin } from "@/lib/google-login"

/**
 * Input: className để trang login tự lo khoảng cách.
 * Output: Nút bắt đầu luồng OAuth Google. Là phần duy nhất của trang login cần
 *         chạy ở client, tách riêng để page giữ được export metadata.
 *
 *         Bấm xong là điều hướng cả trang sang BE — mất một nhịp mà không có phản hồi gì
 *         thì user tưởng nút hỏng và bấm lại. Nên khoá nút + hiện Spinner ngay, và KHÔNG
 *         cần tắt lại: trang này sắp bị thay hoàn toàn.
 */
export function GoogleLoginButton({ className }: { className?: string }) {
  const [redirecting, setRedirecting] = useState(false)

  return (
    <Button
      type="button"
      size="lg"
      disabled={redirecting}
      className={cn("w-full gap-2.5 rounded-xl text-sm font-semibold", className)}
      onClick={() => {
        setRedirecting(true)
        redirectToGoogleLogin({ selectAccount: true })
      }}
    >
      {redirecting ? (
        <Spinner className="size-[18px]" />
      ) : (
        <Image src="/google-icon.svg" alt="" width={18} height={18} aria-hidden="true" />
      )}
      {redirecting ? "Đang chuyển sang Google" : "Tiếp tục với Google"}
    </Button>
  )
}
