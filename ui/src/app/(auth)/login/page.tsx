import type { Metadata } from "next";
import { JoytabLogo } from "@/components/common/joytab-logo";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { GoogleLoginButton } from "../_components/google-login-button";

const PAGE_DESCRIPTION =
  "Đăng nhập Joytab bằng tài khoản Google để quản lý thu chi, quỹ nhóm và báo cáo.";

// Lưu ý: Next thay thế (không merge) cả object openGraph/twitter của layout cha,
// nên phải khai lại siteName/locale/images ở đây.
export const metadata: Metadata = {
  title: "Đăng nhập",
  description: PAGE_DESCRIPTION,
  alternates: { canonical: "/login" },
  openGraph: {
    type: "website",
    siteName: "Joytab",
    locale: "vi_VN",
    url: "/login",
    title: "Đăng nhập Joytab",
    description: PAGE_DESCRIPTION,
    images: [
      {
        url: "/icon_tile.png",
        width: 1024,
        height: 1024,
        alt: "Logo Joytab",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Đăng nhập Joytab",
    description: PAGE_DESCRIPTION,
    images: ["/icon_tile.png"],
  },
};

/**
 * Input: Không nhận tham số.
 * Output: Màn hình đăng nhập Google-only. Toàn bộ là markup tĩnh, chỉ
 *         GoogleLoginButton chạy ở client nên page giữ được export metadata.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-6 py-12">
      <div className="flex w-full max-w-[384px] flex-col items-center gap-8">
        <JoytabLogo className="h-10 w-auto" />

        <Card className="w-full gap-7 py-9">
          <CardHeader className="justify-items-center gap-2 px-8 text-center">
            <CardTitle className="text-2xl font-bold tracking-tight">
              Đăng nhập
            </CardTitle>
            <CardDescription className="text-pretty">
              Quản lý thu chi và quỹ nhóm cùng Joytab
            </CardDescription>
          </CardHeader>

          <CardContent className="px-8">
            <GoogleLoginButton />
          </CardContent>
        </Card>

        <p className="max-w-[300px] text-center text-xs leading-relaxed text-muted-foreground">
          Khi tiếp tục, bạn đồng ý với{" "}
          <span className="font-medium text-foreground">Điều khoản</span> và{" "}
          <span className="font-medium text-foreground">
            Chính sách bảo mật
          </span>{" "}
          của Joytab.
        </p>
      </div>
    </main>
  );
}
