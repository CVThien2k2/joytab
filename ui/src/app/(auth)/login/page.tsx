"use client";

import Image from "next/image";
import { Button } from "@/components/ui/button";
import { JoytabLogo } from "@/components/common/joytab-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { redirectToGoogleLogin } from "@/lib/google-login";

/**
 * Input: Không nhận tham số.
 * Output: Màn hình đăng nhập Google-only.
 */
export default function LoginPage() {
  /**
   * Input: Không nhận tham số.
   * Output: Chuyển browser sang luồng OAuth Google.
   */
  const handleGoogleLogin = () => {
    redirectToGoogleLogin({ selectAccount: true });
  };

  return (
    <main className="flex flex-1 items-center justify-center px-6 py-10">
      <Card className="w-full max-w-[380px] py-7">
        <CardHeader className="justify-items-center gap-2 px-7 pb-3 text-center">
          <div className="mb-1 flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <JoytabLogo iconOnly className="size-12" />
          </div>
          <CardTitle className="text-xl">Đăng nhập Joytab</CardTitle>
          <CardDescription>
            Sử dụng tài khoản Google để tiếp tục.
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col px-7 pt-1">
          <Button
            type="button"
            variant="outline"
            className="h-10 w-full gap-3"
            onClick={handleGoogleLogin}
          >
            <Image
              src="/google-icon.svg"
              alt=""
              width={20}
              height={20}
              aria-hidden="true"
            />
            Tiếp tục với Google
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
