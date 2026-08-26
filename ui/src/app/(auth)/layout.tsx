import { ThemeModeButton } from "@/components/common/theme-mode-button"

/**
 * Input: Nội dung route auth (/login).
 * Output: Chrome dùng chung — nền phẳng + nút đổi theme nổi ở góc trên phải.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <div className="relative isolate flex min-h-screen flex-col overflow-hidden bg-background">
      {/* Quầng sáng màu primary cho nền đỡ trơ. `-z-10` + `isolate` để nó nằm dưới nội
          dung nhưng vẫn trên nền của chính div này. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -z-10 size-[560px] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
      />
      <ThemeModeButton className="absolute top-4 right-4 sm:top-6 sm:right-6" />
      {children}
    </div>
  )
}
