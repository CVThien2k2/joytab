import { RequireAuth } from "@/components/wrapper/require-auth"

/**
 * Input: Nội dung các route private.
 * Output: Bọc RequireAuth — chưa/hết đăng nhập → /login, hợp lệ → render children.
 */
export default function PrivateLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <RequireAuth>{children}</RequireAuth>
}
