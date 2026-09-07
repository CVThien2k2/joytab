import { AuthShell } from "@/components/common/auth-shell"

/**
 * Input: Nội dung route /onboarding.
 * Output: Chrome dùng chung với /login, xem AuthShell.
 *
 * KHÔNG gọi BE ở đây (và cũng không ở page): /auth/me do `OnboardingView` gọi ở client, nên
 * trạng thái "đang kiểm tra" nằm ngay trong component đang chờ chứ không cần `loading.tsx`.
 */
export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return <AuthShell>{children}</AuthShell>
}
