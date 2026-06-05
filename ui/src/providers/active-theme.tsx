"use client"

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
} from "react"

export const COLOR_THEMES = [
  "base",
  "violet",
  "purple",
  "indigo",
  "blue",
  "sky",
  "cyan",
  "teal",
  "emerald",
  "green",
  "lime",
  "yellow",
  "amber",
  "orange",
  "red",
  "rose",
  "pink",
  "fuchsia",
] as const
export type ColorTheme = (typeof COLOR_THEMES)[number]

const STORAGE_KEY = "active-theme"
const CHANGE_EVENT = "active-theme-change"
const DEFAULT_THEME: ColorTheme = "base"

/**
 * Input: giá trị bất kỳ.
 * Output: ColorTheme hợp lệ (fallback về default nếu sai/không có).
 */
function normalize(value: string | null): ColorTheme {
  return (COLOR_THEMES as readonly string[]).includes(value ?? "")
    ? (value as ColorTheme)
    : DEFAULT_THEME
}

// External store: nguồn sự thật là attribute `data-theme` trên <html>
// (đã được ActiveThemeScript set trước paint từ localStorage).
function subscribe(callback: () => void): () => void {
  window.addEventListener(CHANGE_EVENT, callback)
  window.addEventListener("storage", callback)
  return () => {
    window.removeEventListener(CHANGE_EVENT, callback)
    window.removeEventListener("storage", callback)
  }
}

function getSnapshot(): ColorTheme {
  return normalize(document.documentElement.getAttribute("data-theme"))
}

function getServerSnapshot(): ColorTheme {
  return DEFAULT_THEME
}

type ActiveThemeContextValue = {
  theme: ColorTheme
  setTheme: (theme: ColorTheme) => void
  themes: readonly ColorTheme[]
}

const ActiveThemeContext = createContext<ActiveThemeContextValue | null>(null)

/**
 * Input: children.
 * Output: Quản lý "kiểu màu" (color theme) qua attribute `data-theme` trên <html>,
 *         persist vào localStorage. Kết hợp với class `.dark` của next-themes để ra
 *         selector `[data-theme="x"].dark`.
 */
export function ActiveThemeProvider({
  children,
}: {
  children: React.ReactNode
}) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  const setTheme = useCallback((next: ColorTheme) => {
    document.documentElement.setAttribute("data-theme", next)
    localStorage.setItem(STORAGE_KEY, next)
    window.dispatchEvent(new Event(CHANGE_EVENT))
  }, [])

  return (
    <ActiveThemeContext.Provider
      value={{ theme, setTheme, themes: COLOR_THEMES }}
    >
      {children}
    </ActiveThemeContext.Provider>
  )
}

/**
 * Input: không.
 * Output: { theme, setTheme, themes } của color theme hiện tại.
 */
export function useActiveTheme(): ActiveThemeContextValue {
  const ctx = useContext(ActiveThemeContext)
  if (!ctx) {
    throw new Error("useActiveTheme must be used within ActiveThemeProvider")
  }
  return ctx
}

/**
 * Input: không.
 * Output: <script> chạy trước paint để set data-theme từ localStorage → chống nháy.
 *         Đặt trong <head> của root layout.
 */
export function ActiveThemeScript() {
  const code = `(function(){try{var t=localStorage.getItem('${STORAGE_KEY}');var v=${JSON.stringify(
    COLOR_THEMES,
  )};document.documentElement.setAttribute('data-theme',v.indexOf(t)>-1?t:'${DEFAULT_THEME}')}catch(e){}})()`
  return <script dangerouslySetInnerHTML={{ __html: code }} />
}
