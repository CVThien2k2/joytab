import type { Metadata } from "next"
import { Badge } from "@/components/ui/badge"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { GoogleLoginButton } from "../_components/google-login-button"

const PAGE_DESCRIPTION =
  "Đăng nhập Joytab bằng tài khoản Google để quản lý thu chi, quỹ nhóm và báo cáo."

/**
 * Các mảng nghiệp vụ, hiện dưới dạng badge cho biết đăng nhập vào để làm gì.
 * Dùng variant default của Badge nên màu bám theo `primary` của theme.
 */
const MODULES = ["Thu chi", "Quỹ nhóm", "Báo cáo"]

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
    images: [{ url: "/icon_tile.png", width: 1024, height: 1024, alt: "Logo Joytab" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Đăng nhập Joytab",
    description: PAGE_DESCRIPTION,
    images: ["/icon_tile.png"],
  },
}

/**
 * Input: Không nhận tham số.
 * Output: Màn hình đăng nhập Google-only. Không cần guard ở đây: proxy đã đẩy
 *         request có cookie `rt` về `/` trước khi tới trang này.
 *         Markup tĩnh, chỉ GoogleLoginButton chạy ở client nên page vẫn export
 *         được metadata.
 *
 * Mọi màu đều lấy từ token của theme (`primary`, `card`, `muted-foreground`...),
 * không hardcode mã màu — đổi file css theme là cả trang đổi theo.
 */
export default function LoginPage() {
  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="relative bg-primary px-7 pt-7 pb-9 text-primary-foreground">
          {/* Lưới mờ lấy chiều sâu cho dải màu, thuần CSS nên không tốn request ảnh. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07]"
          />
          <p className="relative text-[11px] font-semibold tracking-[0.16em] uppercase opacity-70">
            Quản lý thu chi &amp; quỹ nhóm
          </p>
          <p className="relative mt-1.5 text-2xl font-bold tracking-tight">Joytab</p>
        </div>

        <div className="relative px-7">
          <div className="absolute -top-8 right-7 flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
            <JoytabLogo iconOnly aria-hidden="true" className="h-8 w-8" />
          </div>
        </div>

        <div className="px-7 pt-8 pb-7">
          <h1 className="text-xl font-bold tracking-tight">Đăng nhập</h1>
          <p className="mt-1 text-sm text-muted-foreground">Dùng tài khoản Google của bạn.</p>

          <GoogleLoginButton className="mt-5" />

          <p className="mt-3 text-xs text-muted-foreground">
            Lần đầu đăng nhập, Joytab tự tạo tài khoản cho bạn.
          </p>

          <div className="mt-6 flex flex-wrap gap-2 border-t pt-5">
            {MODULES.map((module) => (
              <Badge key={module}>{module}</Badge>
            ))}
          </div>
        </div>
      </div>
    </main>
  )
}
