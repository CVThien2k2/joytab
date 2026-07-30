"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { fetchMe } from "@/api/auth";
import { LoadingScreen } from "@/components/common/loading-screen";
import { useAuthStore } from "@/stores/auth-store";

/**
 * Input: Không nhận tham số.
 * Output: Gọi /me một lần để lấy user sau khi BE set cookie, rồi điều hướng về /
 *         (thành công) hoặc /login (thất bại). Trong lúc chờ hiện LoadingScreen.
 */
export function AuthCallback() {
  const router = useRouter();
  const setUser = useAuthStore((state) => state.setUser);
  const startedRef = useRef(false);

  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;

    void fetchMe()
      .then((user) => {
        setUser(user);
        router.replace("/");
      })
      .catch(() => {
        router.replace("/login");
      });
  }, [router, setUser]);

  return <LoadingScreen />;
}
