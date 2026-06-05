"use client"

import { useTheme } from "next-themes"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { useMemo, useSyncExternalStore } from "react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Separator } from "@/components/ui/separator"
import { useAccountsStatus } from "@/hooks/use-auth-api"
import { redirectToGoogleLogin } from "@/lib/google-login"
import { useActiveTheme } from "@/providers/active-theme"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: không.
 * Output: Thanh điều khiển theme tạm để test — toggle light/dark + chọn color theme.
 *         (next-themes cần check `mounted` để tránh lệch hydration.)
 */
function ThemeSwitcher() {
  const { resolvedTheme, setTheme } = useTheme()
  const { theme: colorTheme, setTheme: setColorTheme, themes } = useActiveTheme()
  // false trên server + lần render đầu, true sau khi hydrate — tránh lệch hydration
  // mà không cần setState-trong-effect.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  )

  if (!mounted) {
    // Giữ chỗ để layout không nhảy trước khi biết theme thực tế.
    return <div className="h-8" />
  }

  const isDark = resolvedTheme === "dark"

  return (
    <div className="flex items-center gap-2">
      <Select
        value={colorTheme}
        onValueChange={(value) => setColorTheme(value as typeof colorTheme)}
      >
        <SelectTrigger size="sm" className="w-[140px]">
          <SelectValue placeholder="Chọn màu" />
        </SelectTrigger>
        <SelectContent>
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
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={isDark ? "Chuyển sang light" : "Chuyển sang dark"}
      >
        {isDark ? "☀️ Light" : "🌙 Dark"}
      </Button>
    </div>
  )
}

/**
 * Input: Tên hoặc email account.
 * Output: Ký tự đầu (in hoa) làm avatar fallback khi không có ảnh.
 */
function getInitial(nameOrEmail: string): string {
  const trimmed = nameOrEmail.trim()
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?"
}

/**
 * Input: Không nhận tham số; đọc account + trạng thái phiên từ Zustand store.
 * Output: Màn hình login — danh sách tài khoản đã lưu (chuyển/đăng nhập lại tùy phiên) + nút đăng nhập Google.
 */
export default function LoginPage() {
  const router = useRouter()
  // Trigger check status + đồng bộ vào store để biết account nào còn phiên / đã hết hạn.
  useAccountsStatus()
  const accounts = useAuthStore((s) => s.accounts)
  const accountStatus = useAuthStore((s) => s.accountStatus)
  const setActiveAccount = useAuthStore((s) => s.setActiveAccount)
  const accountList = useMemo(() => Object.values(accounts), [accounts])
  const hasAccounts = accountList.length > 0

  /**
   * Input: accountId account muốn dùng (phiên còn hạn).
   * Output: Đặt active rồi vào app.
   */
  const handleSwitch = (accountId: string) => {
    setActiveAccount(accountId)
    router.replace("/")
  }

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <header className="flex items-center justify-end border-b px-6 py-3">
        <ThemeSwitcher />
      </header>
      <main className="flex flex-1 items-center justify-center p-6">
        <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <Image
            src="/joytab-logo-horizontal.svg"
            alt="Joytab"
            width={120}
            height={42}
            priority
            unoptimized
            className="mx-auto h-10 w-auto"
          />
          <CardTitle className="mt-4">Đăng nhập</CardTitle>
          <CardDescription>
            {hasAccounts
              ? "Chọn tài khoản hoặc đăng nhập với Google."
              : "Đăng nhập bằng Google để tiếp tục."}
          </CardDescription>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
          {hasAccounts ? (
            <ItemGroup className="gap-2">
              {accountList.map((account) => {
                const needsRelogin = accountStatus[account.userId] ?? false
                const name = account.user.fullName ?? account.user.email
                return (
                  <Item key={account.userId} variant="outline">
                    <ItemMedia variant="image">
                      <Avatar>
                        {account.user.avatarUrl ? (
                          <AvatarImage src={account.user.avatarUrl} alt={name} />
                        ) : null}
                        <AvatarFallback>{getInitial(name)}</AvatarFallback>
                      </Avatar>
                    </ItemMedia>
                    <ItemContent>
                      <ItemTitle>{name}</ItemTitle>
                      <ItemDescription>
                        {needsRelogin ? "Phiên đã hết hạn" : account.user.email}
                      </ItemDescription>
                    </ItemContent>
                    <ItemActions>
                      {needsRelogin ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          onClick={() => redirectToGoogleLogin({ selectAccount: true })}
                        >
                          Đăng nhập lại
                        </Button>
                      ) : (
                        <Button type="button" size="sm" onClick={() => handleSwitch(account.userId)}>
                          Chuyển tài khoản
                        </Button>
                      )}
                    </ItemActions>
                  </Item>
                )
              })}
            </ItemGroup>
          ) : null}

          {hasAccounts ? (
            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-xs text-muted-foreground">hoặc</span>
              <Separator className="flex-1" />
            </div>
          ) : null}

          <Button
            type="button"
            variant={hasAccounts ? "outline" : "default"}
            className="w-full"
            onClick={() => redirectToGoogleLogin({ selectAccount: hasAccounts })}
          >
            Đăng nhập với Google
          </Button>
        </CardContent>
        </Card>
      </main>
    </div>
  )
}
