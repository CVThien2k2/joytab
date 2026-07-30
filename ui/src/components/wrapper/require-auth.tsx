"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: children (nội dung cần đăng nhập mới xem được).
 * Output: Guard đọc `user` + `hydrated` từ store:
 *  - chưa rehydrate → chưa biết gì, không render và cũng KHÔNG redirect.
 *  - rehydrate xong mà không có user → redirect /login.
 *  - có user → render children.
 *
 * Phải chờ `hydrated`: ở render đầu tiên store luôn rỗng, nếu redirect ngay thì người
 * đang đăng nhập cũng bị đẩy về /login. Chờ ở đây chỉ dài một tick (đọc localStorage),
 * không phải chờ network — nên không cần màn loading; trang bên trong tự lo skeleton
 * cho dữ liệu của nó.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (hydrated && !user) {
      router.replace("/login");
    }
  }, [hydrated, user, router]);

  if (!hydrated || !user) return null;

  return <>{children}</>;
}
