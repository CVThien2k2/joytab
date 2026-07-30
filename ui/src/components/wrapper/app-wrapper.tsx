"use client";

import { useEffect, type ReactNode } from "react";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: children — bọc TOÀN app (trong QueryProvider).
 * Output: Kích hoạt rehydrate store từ localStorage rồi render children ngay.
 *
 * Store dùng `skipHydration` nên phải gọi rehydrate() ở đây: làm trong useEffect để render
 * đầu tiên của client giống hệt server (đều chưa có user), tránh hydration mismatch.
 *
 * KHÔNG chặn render bằng màn loading: chỗ nào cần biết đã rehydrate xong thì tự đọc
 * `hydrated` từ store (vd RequireAuth/RequireGuest) và tự quyết skeleton của mình.
 *
 * KHÔNG gọi /auth/me ở đây: user đã được trang /login/callback lưu vào localStorage lúc login.
 */
export function AppWrapper({ children }: { children: ReactNode }) {
  useEffect(() => {
    void useAuthStore.persist.rehydrate();
  }, []);

  return children;
}
