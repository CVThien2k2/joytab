"use client"

import { LogOut } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/providers/auth-store-provider"

/**
 * Input: Tên/email của user (có thể null).
 * Output: 1–2 ký tự viết tắt cho avatar khi không tải được ảnh. Ưu tiên chữ cái đầu của
 *         tên; user chưa onboarding chưa chắc có fullName nên rơi về email.
 */
function initialsOf(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email
  const words = source.split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}

/**
 * Input: Không nhận props — user lấy từ store (do PrivateLayout bơm vào).
 * Output: Avatar ở header, bấm vào mở dropdown: tên + email, rồi nút đăng xuất.
 *
 *         Không render gì nếu store chưa có user: header chỉ xuất hiện trong nhóm route đã
 *         đăng nhập nên đây là nhánh không xảy ra, nhưng để im lặng còn hơn vẽ avatar rỗng.
 *
 *         Đang đăng xuất thì khoá item lại — mutation không idempotent về mặt UX, bấm hai
 *         lần sẽ bắn hai request revoke.
 */
export function UserMenu() {
  const user = useAuthStore((state) => state.user)
  const logout = useLogout()

  if (!user) return null

  const displayName = user.user.fullName?.trim() || user.user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Mở menu tài khoản"
      >
        <Avatar>
          {user.user.avatarUrl ? (
            <AvatarImage src={user.user.avatarUrl} alt="" referrerPolicy="no-referrer" />
          ) : null}
          <AvatarFallback>{initialsOf(user.user.fullName, user.user.email)}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" />
          {logout.isPending ? "Đang đăng xuất" : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
