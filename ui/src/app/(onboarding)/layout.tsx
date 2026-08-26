import { AuthShell } from "@/components/common/auth-shell"

/**
 * Input: Nội dung route /onboarding.
 * Output: Chrome dùng chung với /login, xem AuthShell.
 *
 * Cố tình KHÔNG async và KHÔNG gọi /auth/me ở đây: `loading.tsx` của một segment chỉ bọc
 * page (và segment con) của nó, layout cùng cấp nằm NGOÀI Suspense boundary đó. Để việc chờ
 * ở layout thì không có gì hiện ra trong lúc chờ — fetch phải nằm trong page mới có trạng
 * thái "đang kiểm tra".
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
