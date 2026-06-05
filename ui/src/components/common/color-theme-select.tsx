"use client"

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useActiveTheme } from "@/providers/active-theme"

/**
 * Input: không.
 * Output: Select chọn color theme dùng chung.
 */
export function ColorThemeSelect() {
  const {
    theme: colorTheme,
    setTheme: setColorTheme,
    themes,
  } = useActiveTheme()

  return (
    <Select
      value={colorTheme}
      onValueChange={(value) => setColorTheme(value as typeof colorTheme)}
    >
      <SelectTrigger size="sm" className="w-[140px]">
        <SelectValue placeholder="Chọn màu" />
      </SelectTrigger>
      <SelectContent position="popper">
        {themes.map((name) => (
          <SelectItem key={name} value={name} className="capitalize">
            <span
              className="size-3 rounded-full border"
              data-theme={name}
              style={{ backgroundColor: "var(--primary)" }}
            />
            {name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
