import type { Metadata } from "next";
import { AuthCallback } from "./_components/auth-callback";

export const metadata: Metadata = {
  title: "Đang xác thực",
  description: "Hoàn tất đăng nhập Google và chuyển bạn về Joytab.",
  // Trang trung gian của luồng OAuth: không index, không theo link, không cache.
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Input: Không nhận tham số.
 * Output: Điểm hạ cánh sau khi Google redirect về; xử lý nằm ở AuthCallback.
 */
export default function AuthCallbackPage() {
  return <AuthCallback />;
}
