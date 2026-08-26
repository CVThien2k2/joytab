"use client"

import Image from "next/image"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { redirectToGoogleLogin } from "@/lib/google-login"

/**
 * Input: className để trang login tự lo khoảng cách.
 * Output: Nút bắt đầu luồng OAuth Google. Là phần duy nhất của trang login cần
 *         chạy ở client, tách riêng để page giữ được export metadata.
 */
export function GoogleLoginButton({ className }: { className?: string }) {
  return (
    <Button
      type="button"
      size="lg"
      className={cn("w-full gap-2.5 rounded-xl text-sm font-semibold", className)}
      onClick={() => redirectToGoogleLogin({ selectAccount: true })}
    >
      <Image src="/google-icon.svg" alt="" width={18} height={18} aria-hidden="true" />
      Tiếp tục với Google
    </Button>
  )
}
