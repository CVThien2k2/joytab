"use client"

import { ColorThemeSelect } from "@/components/common/color-theme-select"
import { JoytabLogo } from "@/components/common/joytab-logo"
import { ThemeModeButton } from "@/components/common/theme-mode-button"

/**
 * Input: không.
 * Output: Nhóm điều khiển theme trên header.
 */
function ThemeSwitcher() {
  return (
    <div className="flex items-center gap-2">
      <ColorThemeSelect />
      <ThemeModeButton />
    </div>
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
      <ThemeSwitcher />
    </header>
  )
}
