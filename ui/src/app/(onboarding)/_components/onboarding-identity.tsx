"use client"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { useAuthStore } from "@/providers/auth-store-provider"

/**
 * Input: Không nhận props — đọc user từ store (layout đã bơm vào từ /auth/me).
 * Output: Dòng cho biết đang onboarding cho tài khoản Google NÀO.
 *
 * Cần thiết vì user có nhiều tài khoản Google: phải thấy ngay mình đang khai cho tài khoản
 * nào, chứ không điền xong mới phát hiện đăng nhập nhầm.
 */
export function OnboardingIdentity() {
  // Store giữ cả envelope { userId, user }; ở đây chỉ cần phần profile.
  const profile = useAuthStore((state) => state.user?.user)
  if (!profile) return null

  const initial = (profile.fullName ?? profile.email).trim().charAt(0).toUpperCase()

  return (
    <div className="mt-5 flex items-center gap-3 rounded-xl border bg-muted/40 px-3 py-2.5">
      <Avatar className="size-9">
        {profile.avatarUrl && <AvatarImage src={profile.avatarUrl} alt="" />}
        <AvatarFallback>{initial}</AvatarFallback>
      </Avatar>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">
          Tài khoản Google
        </p>
        <p className="truncate text-sm font-medium">{profile.email}</p>
      </div>
    </div>
  )
}
