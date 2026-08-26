import { fetchCurrentUser } from "@/api/auth.server"
import { AuthStoreProvider } from "@/providers/auth-store-provider"

/**
 * Input: Nội dung các route đã đăng nhập.
 * Output: Chỗ DUY NHẤT gọi /auth/me — lấy user một lần cho cả nhóm route rồi bơm vào store.
 *         Proxy đã chặn request không có `rt`, nên tới đây mà lỗi là phiên chết thật
 *         hoặc BE không với tới được → hiện thẳng lý do ra màn hình.
 */
export default async function PrivateLayout({ children }: { children: React.ReactNode }) {
  // Không destructure: narrowing của union chỉ chạy khi kiểm tra trực tiếp trên property.
  const result = await fetchCurrentUser()

  if (!result.user) {
    return (
      <main className="p-6">
        <pre className="text-xs text-red-600">{result.error}</pre>
      </main>
    )
  }

  return <AuthStoreProvider initialState={{ user: result.user }}>{children}</AuthStoreProvider>
}
