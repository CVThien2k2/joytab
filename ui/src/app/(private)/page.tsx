import type { Metadata } from "next";
import { CurrentUserCard } from "./_components/current-user-card";

export const metadata: Metadata = {
  title: "Trang chủ",
  description: "Tổng quan tài khoản Joytab của bạn.",
  alternates: { canonical: "/" },
  // Khu vực sau đăng nhập: không cho index.
  robots: { index: false, follow: false },
};

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ (CSR) — CurrentUserCard đọc user từ store.
 */
export default function HomePage() {
  return <CurrentUserCard />;
}
