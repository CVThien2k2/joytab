import { CurrentUserCard } from "./_components/current-user-card"

/**
 * Input: Không nhận tham số.
 * Output: Trang chủ (CSR) — CurrentUserCard tự lấy user qua useMe.
 */
export default function HomePage() {
  return <CurrentUserCard />
}
