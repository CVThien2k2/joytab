"use client"

import { useTheme } from "next-themes"
import { useSyncExternalStore } from "react"
import { Button } from "@/components/ui/button"

/**
 * Input: không.
 * Output: Button đổi light/dark theme dùng chung.
 */
export function ThemeModeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    return <div className="h-8" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <Button
      type="button"
      size="sm"
      variant="outline"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Chuyển sang light" : "Chuyển sang dark"}
    >
      {isDark ? "☀️ Light" : "🌙 Dark"}
    </Button>
  )
}
