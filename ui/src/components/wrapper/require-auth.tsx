"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: children (nội dung cần đăng nhập mới xem được).
 * Output: Guard đọc `user` từ store:
 *  - không có user → redirect /login.
 *  - có user → render children.
 *
 * Không cần lo trạng thái "chưa biết": AppWrapper đã chặn render tới khi store rehydrate xong.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);

  useEffect(() => {
    if (!user) {
      router.replace("/login");
    }
  }, [user, router]);

  if (!user) return null;

  return <>{children}</>;
}
