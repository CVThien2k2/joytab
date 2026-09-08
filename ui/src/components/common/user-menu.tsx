"use client"

import { useState } from "react"
import { CircleUser, LogOut } from "lucide-react"
import { AccountAvatar } from "@/components/common/account-avatar"
import { ProfileDialog } from "@/components/common/profile-dialog"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useLogout } from "@/hooks/use-auth-api"
import { useAuthStore } from "@/stores/auth-store"

/**
 * Input: Không nhận props — user lấy từ store (do PrivateLayout bơm vào).
 * Output: Avatar ở header, bấm vào mở dropdown: tên + email, mục thông tin cá nhân, rồi nút
 *         đăng xuất.
 *
 *         Mục thông tin cá nhân PHẢI có ở đây chứ không chỉ ở menu tài khoản trên sidebar: header
 *         này là của người CHƯA vào tổ chức nào, mà sidebar thì chỉ dựng được khi đã có tổ chức.
 *         Thiếu nó thì nhóm người đó không còn đường nào sửa hồ sơ của chính mình.
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
  const [profileOpen, setProfileOpen] = useState(false)

  if (!user) return null

  const displayName = user.user.fullName?.trim() || user.user.email

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        aria-label="Mở menu tài khoản"
      >
        <AccountAvatar name={displayName} src={user.user.avatarUrl} />
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate font-medium">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{user.user.email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => setProfileOpen(true)}>
          <CircleUser aria-hidden="true" />
          Thông tin cá nhân
        </DropdownMenuItem>
        <DropdownMenuItem
          variant="destructive"
          disabled={logout.isPending}
          onSelect={() => logout.mutate()}
        >
          <LogOut aria-hidden="true" />
          {logout.isPending ? "Đang đăng xuất" : "Đăng xuất"}
        </DropdownMenuItem>
      </DropdownMenuContent>

      {/* Ngoài DropdownMenu: Radix đóng dropdown khi chọn item, hộp thoại nằm trong item sẽ bị
          unmount ngay lúc vừa mở — cùng lý do với các dialog ở `SidebarProfileMenu`. */}
      <ProfileDialog open={profileOpen} onOpenChange={setProfileOpen} />
    </DropdownMenu>
  )
}
