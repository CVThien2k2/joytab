import { HomePageClient } from "./home-page-client"

/**
 * Input: Không nhận tham số.
 * Output: Render trang chủ trong khu vực đã đăng nhập; auth được middleware đảm bảo trước khi tới.
 */
export default function HomePage() {
  return <HomePageClient />
}
