import { apiClient } from "@/api/client"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"
import type { OnboardingPayload } from "@/types/onboarding"

/**
 * Input: 4 field đã qua validate của onboardingFormSchema.
 * Output: User sau khi lưu (đã `onboarded: true`) để bơm thẳng vào store — không cần gọi lại
 *         /auth/me. Response cũng mang Set-Cookie xoá cookie `onb`, nhờ đó lần điều hướng
 *         ngay sau đó proxy đã cho vào app.
 *
 *         Parse lại bằng meResponseSchema thay vì tin response: shape sai thì phải nổ ở đây
 *         chứ không phải ở component đọc `user.fullName`.
 */
export async function completeOnboarding(payload: OnboardingPayload): Promise<CurrentUser> {
  const response = await apiClient.post("/auth/onboarding", payload)
  return meResponseSchema.parse(response.data).data
}
