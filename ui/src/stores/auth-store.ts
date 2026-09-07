import { create } from "zustand"
import type { CurrentUser } from "@/types/auth"

export type AuthStore = {
  /** User đang đăng nhập. `null` = chưa bootstrap xong (hoặc đang ở khu chưa đăng nhập). */
  user: CurrentUser | null
  setUser: (user: CurrentUser | null) => void
  clearUser: () => void
}

/**
 * Store toàn cục, tạo đúng MỘT lần ở module scope — không còn factory + context.
 *
 * Trước đây phải làm phức tạp (createStore theo từng request + Provider bơm initialState) vì
 * Next server component fetch /auth/me rồi truyền xuống: biến module-scope trên server bị chia
 * sẻ giữa các request đồng thời nên user này đọc thấy dữ liệu của user khác.
 *
 * Giờ KHÔNG server component nào ghi vào đây nữa — dữ liệu chỉ đến từ query /auth/me chạy trên
 * browser (xem useMe), nên mỗi tab là một JS context riêng và không có gì để lẫn. Lúc SSR store
 * luôn là `user: null` và chưa ai đọc tới, vì SessionGate chỉ render children sau khi có user.
 */
export const useAuthStore = create<AuthStore>()((set) => ({
  user: null,
  setUser: (user) => set({ user }),
  clearUser: () => set({ user: null }),
}))
