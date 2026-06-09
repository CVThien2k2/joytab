"use client"

import { useQuery } from "@tanstack/react-query"
import Link from "next/link"
import { fetchUsersWithoutCookie } from "@/api/users"
import { Button } from "@/components/ui/button"

/**
 * [DEMO] Trang xem users. Server gate (private layout) vẫn cho vào vì cookie hợp lệ,
 * nhưng client fetch /users CỐ TÌNH bỏ cookie → 401 → interceptor bật popup hết phiên.
 * Dùng để quan sát UX: đang ở giữa phiên thì 1 call lỗi 401 hiện popup ra sao.
 */
export default function UsersPage() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["demo", "users"],
    queryFn: fetchUsersWithoutCookie,
    retry: false,
  })

  return (
    <main className="min-h-screen bg-zinc-50 p-6">
      <div className="mx-auto w-full max-w-xl space-y-4">
        <Button asChild variant="outline" size="sm">
          <Link href="/">← Về trang chủ</Link>
        </Button>

        <section className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h1 className="text-sm font-semibold text-zinc-900">Danh sách users (demo)</h1>

          {isPending ? <p className="mt-4 text-sm text-zinc-600">Đang tải…</p> : null}
          {isError ? (
            <p className="mt-4 text-sm text-red-600">
              Gọi /users bị 401 (không gửi cookie) → popup hết phiên đang hiện.
            </p>
          ) : null}

          {data ? (
            <ul className="mt-4 space-y-2 text-sm text-zinc-800">
              {data.map((u) => (
                <li key={u.id} className="border-b border-zinc-100 pb-1">
                  <span className="font-medium">{u.fullName}</span> — {u.email}
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </main>
  )
}
