"use client";

import { JoytabLogo } from "@/components/common/joytab-logo";
import { LogoutButton } from "@/components/common/logout-button";
import { ThemeModeButton } from "@/components/common/theme-mode-button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: Email và tên đầy đủ (có thể null).
 * Output: 1-2 chữ cái đại diện cho avatar fallback.
 */
function initialsOf(fullName: string | null, email: string): string {
  const source = fullName?.trim() || email;
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return source.slice(0, 2).toUpperCase();
}

/**
 * Input: Không nhận props; đọc user từ store.
 * Output: Header của khu vực đã đăng nhập — logo, nút đổi theme, avatar + email,
 *         nút đăng xuất. Chỉ render khi có user (RequireAuth đã đảm bảo).
 */
export function AppHeader() {
  const user = useAuthStore((state) => state.user);

  if (!user) return null;

  const { email, fullName, avatarUrl } = user.user;

  return (
    <header className="flex shrink-0 items-center justify-between gap-3 border-b px-4 py-3 sm:px-5">
      <JoytabLogo className="h-8 w-auto sm:h-9" />

      <div className="flex items-center gap-2 sm:gap-3">
        <ThemeModeButton />

        <div className="flex items-center gap-2">
          <Avatar size="sm">
            {avatarUrl ? <AvatarImage src={avatarUrl} alt="" /> : null}
            <AvatarFallback>{initialsOf(fullName, email)}</AvatarFallback>
          </Avatar>
          <span className="hidden max-w-[180px] truncate text-xs text-muted-foreground sm:inline">
            {email}
          </span>
        </div>

        <LogoutButton />
      </div>
    </header>
  );
}
