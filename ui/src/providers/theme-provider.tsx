"use client"

import { ThemeProvider as NextThemesProvider } from "next-themes"

/**
 * Input: children + props của next-themes.
 * Output: Provider quản lý light/dark qua class trên <html>.
 */
export function ThemeProvider({
  children,
  ...props
}: React.ComponentProps<typeof NextThemesProvider>) {
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>
}
