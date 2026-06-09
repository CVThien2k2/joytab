"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { LoadingScreen } from "@/components/common/loading-screen";

/**
 * Input: children (nội dung cần đăng nhập mới xem được).
 * Output: Guard đọc store (useMe bơm vào):
 *  - chưa validate xong (!checked) → LoadingScreen.
 *  - xong mà không có user (hết phiên / chưa login) → redirect /login.
 *  - có user → render children.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const checked = useAuthStore((state) => state.checked);

  useEffect(() => {
    if (checked && !user) {
      router.replace("/login");
    }
  }, [checked, user, router]);

  if (!checked) return <LoadingScreen />;

  if (!user) return null;

  return <>{children}</>;
}
