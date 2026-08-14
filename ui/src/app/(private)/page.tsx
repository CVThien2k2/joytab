import type { Metadata } from "next";
import { OrganizationList } from "./_components/organization-list";

export const metadata: Metadata = {
  title: "Nhóm của tôi",
  description: "Các nhóm cầu lông bạn đang tham gia.",
  alternates: { canonical: "/" },
  robots: { index: false, follow: false },
};

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ sau đăng nhập — danh sách nhóm + lối tạo nhóm mới.
 */
export default function HomePage() {
  return <OrganizationList />;
}
