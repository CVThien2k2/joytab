"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Input: children + props của next-themes.
 * Output: Quản lý mode light/dark qua class `.dark` trên <html> (chuẩn shadcn dark-mode).
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
