import { CurrentUserCard } from "./_components/current-user-card"

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ — hiển thị user hiện tại (đọc từ store đã hydrate ở layout).
 */
export default function HomePage() {
  return <CurrentUserCard />
}
