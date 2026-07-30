"use client";

import { Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ThemeModeButtonProps = {
  className?: string;
  /** Kích thước nút, map sang size icon của Button. Mặc định "sm" (size-8). */
  size?: "sm" | "default" | "lg";
  /** Variant của Button, mặc định "outline". */
  variant?: React.ComponentProps<typeof Button>["variant"];
};

const ICON_SIZE = {
  sm: "icon-sm",
  default: "icon",
  lg: "icon-lg",
} as const;

/**
 * Input: className để định vị, size/variant để khớp ngữ cảnh đặt nút.
 * Output: Nút đổi light/dark. Hiệu ứng sun/moon scale + rotate chạy hoàn toàn
 *         bằng variant `dark:` (theo class trên <html> của next-themes) nên
 *         markup server và client giống nhau — không cần chờ mounted, không có
 *         placeholder nhảy layout. aria-label giữ tĩnh cũng vì lý do đó.
 */
export function ThemeModeButton({
  className,
  size = "sm",
  variant = "outline",
}: ThemeModeButtonProps) {
  const { resolvedTheme, setTheme } = useTheme();

  return (
    <Button
      type="button"
      size={ICON_SIZE[size]}
      variant={variant}
      className={cn("relative overflow-hidden", className)}
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      aria-label="Đổi giao diện sáng/tối"
    >
      <Sun
        className="size-4 rotate-0 scale-100 transition-transform duration-500 dark:-rotate-90 dark:scale-0"
        aria-hidden="true"
      />
      <Moon
        className="absolute size-4 rotate-90 scale-0 transition-transform duration-500 dark:rotate-0 dark:scale-100"
        aria-hidden="true"
      />
      <span className="sr-only">Đổi giao diện sáng/tối</span>
    </Button>
  );
}
