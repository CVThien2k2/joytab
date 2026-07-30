"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { redirectToGoogleLogin } from "@/lib/google-login";

/**
 * Input: Không nhận tham số.
 * Output: Nút bắt đầu luồng OAuth Google. Là phần duy nhất của trang login cần
 *         chạy ở client, tách riêng để page giữ được export metadata.
 */
export function GoogleLoginButton() {
  return (
    <Button
      type="button"
      className="h-12 w-full gap-2.5 rounded-full text-[15px] font-semibold"
      onClick={() => redirectToGoogleLogin({ selectAccount: true })}
    >
      <Image
        src="/google-icon.svg"
        alt=""
        width={16}
        height={16}
        aria-hidden="true"
      />
      Tiếp tục với Google
    </Button>
  );
}
