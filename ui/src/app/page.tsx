import { Suspense } from "react"
import { HomePageClient } from "./home-page-client"

/**
 * Input: Không nhận tham số từ caller.
 * Output: Render trang chủ client dưới Suspense để hỗ trợ useSearchParams trong App Router.
 */
export default function HomePage() {
  return (
    <Suspense fallback={null}>
      <HomePageClient />
    </Suspense>
  )
}

