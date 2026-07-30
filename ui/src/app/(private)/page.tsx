import type { Metadata } from "next";
import { RoutePlanner } from "./_components/route-planner";

export const metadata: Metadata = {
  title: "Bản đồ",
  description:
    "Demo OpenStreetMap: chọn hai điểm, tìm kiếm địa điểm và tính khoảng cách.",
  alternates: { canonical: "/" },
  // Khu vực sau đăng nhập: không cho index.
  robots: { index: false, follow: false },
};

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ — demo OpenStreetMap + Leaflet (CSR toàn bộ).
 */
export default function HomePage() {
  return <RoutePlanner />;
}
