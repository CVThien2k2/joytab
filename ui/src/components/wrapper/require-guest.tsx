"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: children (nội dung chỉ dành cho khách CHƯA đăng nhập, vd form /login).
 * Output: Guard đọc `user` + `hydrated` từ store:
 *  - chưa rehydrate → chưa biết gì, chưa render form để tránh nháy rồi bị đẩy đi.
 *  - đã đăng nhập → redirect /.
 *  - chưa đăng nhập → render children.
 *
 * Chờ `hydrated` chỉ dài một tick (đọc localStorage), không phải chờ network.
 */
export function RequireGuest({ children }: { children: ReactNode }) {
  const router = useRouter();
  const user = useAuthStore((state) => state.user);
  const hydrated = useAuthStore((state) => state.hydrated);

  useEffect(() => {
    if (hydrated && user) {
      router.replace("/");
    }
  }, [hydrated, user, router]);

  if (!hydrated || user) return null;

  return <>{children}</>;
}
