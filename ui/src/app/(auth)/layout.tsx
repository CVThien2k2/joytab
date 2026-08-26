import { AuthShell } from "@/components/common/auth-shell"

/**
 * Input: Nội dung route auth (/login).
 * Output: Chrome dùng chung với /onboarding, xem AuthShell.
 */
export default function AuthLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return <AuthShell>{children}</AuthShell>
}
