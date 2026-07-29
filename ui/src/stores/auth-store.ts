import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { CurrentUser } from "@/types/auth"

type AuthState = {
  /** User hiện tại (null nếu chưa đăng nhập). */
  user: CurrentUser | null
  /** persist đã đọc xong localStorage — trước đó KHÔNG được render theo `user`. */
  hydrated: boolean
  setUser: (user: CurrentUser) => void
  clearUser: () => void
}

/**
 * Store auth toàn app, persist vào localStorage.
 *
 * Boot KHÔNG gọi /auth/me: user được bơm vào đúng một lần ở trang /auth/callback sau khi
 * login, sau đó load lại trang là đọc thẳng từ localStorage nên hiển thị ngay, không nháy
 * loading.
 *
 * Đánh đổi: localStorage không biết cookie còn hạn hay không, nên nếu cookie đã hết hạn mà
 * localStorage còn user thì UI vẫn hiện trạng thái đã đăng nhập cho tới request API đầu tiên
 * — lúc đó interceptor ở api/client.ts nhận 401 và đẩy về /login.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      hydrated: false,
      setUser: (user) => set({ user }),
      clearUser: () => set({ user: null }),
    }),
    {
      name: "joytab-auth",
      // Chỉ persist `user`: `hydrated` là trạng thái runtime của chính persist, lưu lại
      // sẽ khiến lần load sau đọc ra `true` trước khi thực sự rehydrate xong.
      partialize: (state) => ({ user: state.user }),
      // Hydrate thủ công trong AppWrapper (useEffect) thay vì lúc import module: nếu để
      // persist tự chạy, client có user ngay ở render đầu tiên trong khi server render ra
      // null → React báo hydration mismatch.
      skipHydration: true,
      onRehydrateStorage: () => () => {
        useAuthStore.setState({ hydrated: true })
      },
    },
  ),
)
