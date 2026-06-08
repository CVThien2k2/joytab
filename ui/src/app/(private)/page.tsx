import { getCurrentUser } from "@/api/auth-server"
import { LogoutButton } from "./_components/logout-button"

/**
 * Input: Không nhận tham số.
 * Output: Server Component — hiển thị user hiện tại lấy từ server (getCurrentUser, đã cache theo request).
 *         (private)/layout đã validate session hợp lệ trước khi render.
 */
export default async function HomePage() {
  const user = await getCurrentUser()

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl">
        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-semibold text-zinc-900">Tài khoản đang dùng</h2>
            <LogoutButton />
          </div>

          {user ? (
            <div className="mt-4 space-y-1 text-sm text-zinc-800">
              <p className="font-medium">{user.user.fullName ?? user.user.email}</p>
              <p className="text-zinc-600">{user.user.email}</p>
              <p className="text-xs text-zinc-500">ID: {user.userId}</p>
            </div>
          ) : null}
        </section>
      </div>
    </main>
  )
}
