import { ThemeModeButton } from "@/components/common/theme-mode-button";

/**
 * Input: Nội dung route auth (/login).
 * Output: Chrome dùng chung — nền phẳng + nút đổi theme nổi ở góc trên phải.
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
