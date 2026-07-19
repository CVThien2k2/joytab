"use client"

import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

function ThemeModeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return <div className="size-8" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      size="icon-sm"
      variant="outline"
      className="relative overflow-hidden"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Chuyển sang light" : "Chuyển sang dark"}
    >
      <Sun
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          isDark
            ? "translate-y-5 rotate-90 opacity-0"
            : "translate-y-0 rotate-0 opacity-100",
        )}
        aria-hidden="true"
      />
      <Moon
        className={cn(
          "absolute size-4 transition-all duration-300 ease-out",
          isDark
            ? "translate-y-0 rotate-0 opacity-100"
            : "-translate-y-5 -rotate-90 opacity-0",
        )}
        aria-hidden="true"
      />
    </Button>
  )
}

/**
 * Input: không.
 * Output: Header dùng chung cho các trang trong nhóm auth.
 */
export function AuthHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
      <JoytabLogo className="h-10 w-auto sm:h-11" />
      <ThemeModeButton />
    </header>
  )
}
