import { JoytabLogo } from "@/components/common/joytab-logo"
import { cn } from "@/lib/utils"

/**
 * Input: `eyebrow` (dòng chữ nhỏ in hoa), `brand` (tên lớn), `className` để đổi bề rộng,
 *        và nội dung thân card.
 * Output: Card dùng chung của /login và /onboarding: dải màu primary có lưới mờ, ô logo nổi
 *         lệch xuống mép dải màu, rồi tới phần nội dung.
 *
 * Server component thuần — mọi phần cần tương tác (nút Google, form) do caller truyền vào,
 * nhờ đó page vẫn export được metadata.
 *
 * Mọi màu đều lấy từ token của theme (`primary`, `card`, `muted-foreground`...), không
 * hardcode mã màu — đổi file css theme là cả trang đổi theo.
 */
export function AuthCard({
  eyebrow,
  brand,
  className,
  children,
}: Readonly<{
  eyebrow: string
  brand: string
  className?: string
  children: React.ReactNode
}>) {
  return (
    <div
      className={cn(
        "w-full max-w-sm overflow-hidden rounded-2xl border bg-card shadow-sm",
        className,
      )}
    >
      <div className="relative bg-primary px-7 pt-7 pb-9 text-primary-foreground">
        {/* Lưới mờ lấy chiều sâu cho dải màu, thuần CSS nên không tốn request ảnh. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 [background-image:linear-gradient(to_right,currentColor_1px,transparent_1px),linear-gradient(to_bottom,currentColor_1px,transparent_1px)] [background-size:20px_20px] opacity-[0.07]"
        />
        <p className="relative text-[11px] font-semibold tracking-[0.16em] uppercase opacity-70">
          {eyebrow}
        </p>
        <p className="relative mt-1.5 text-2xl font-bold tracking-tight">{brand}</p>
      </div>

      <div className="relative px-7">
        <div className="absolute -top-8 right-7 flex size-16 items-center justify-center rounded-2xl border bg-card shadow-sm">
          <JoytabLogo iconOnly aria-hidden="true" className="h-8 w-8" />
        </div>
      </div>

      <div className="px-7 pt-8 pb-7">{children}</div>
    </div>
  )
}
