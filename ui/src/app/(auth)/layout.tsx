import { ThemeModeButton } from "@/components/common/theme-mode-button";

/**
 * Input: Nội dung các route auth (/login, /login/callback).
 * Output: Chrome dùng chung — nền phẳng + nút đổi theme nổi ở góc trên phải.
 *
 * KHÔNG bọc RequireGuest ở đây: /login/callback phải chạy được cả khi store còn
 * user cũ (luồng đổi/thêm tài khoản), nếu bị guard nó sẽ bị đẩy về `/` trước khi
 * fetchMe() kịp cập nhật user mới. Guard nằm trong login/page.tsx.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="relative flex min-h-screen flex-col bg-background">
      <ThemeModeButton className="absolute top-4 right-4 sm:top-6 sm:right-6" />
      {children}
    </div>
  );
}
