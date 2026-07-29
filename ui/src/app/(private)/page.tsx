import { CurrentUserCard } from "./_components/current-user-card"

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ (CSR) — CurrentUserCard đọc user từ store.
 */
export default function HomePage() {
  return <CurrentUserCard />
}
