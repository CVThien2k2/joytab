import { create } from "zustand"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  /** User hiện tại (null nếu chưa đăng nhập / hết phiên). */
  user: CurrentUser | null
  /** Đã hoàn tất 1 lần validate /auth/me — trước đó hiện loading. */
  checked: boolean
  /** Phiên bị thu hồi (AUTH_004) → hiện popup. */
  revoked: boolean
}

/**
 * Store auth toàn app — không persist (luôn chờ /auth/me validate, hiện loading tới khi `checked`).
 * useMe (queryFn) cập nhật store ngay sau khi gọi; wrapper/component chỉ đọc ra dùng.
 */
export const useAuthStore = create<AuthState>(() => ({
  user: null,
  checked: false,
  revoked: false,
}))
