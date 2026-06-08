import { apiClient } from "@/api/client"

/**
 * Input: selectAccount=true khi muốn ép Google hiện màn chọn tài khoản (luồng thêm tài khoản).
 * Output: Chuyển hướng browser sang BE /auth/google để bắt đầu OAuth.
 */
export function redirectToGoogleLogin(options?: { selectAccount?: boolean }): void {
  const apiBaseUrl = apiClient.defaults.baseURL ?? "http://localhost:8000"
  const authUrl = new URL("/auth/google", apiBaseUrl)
  if (options?.selectAccount) {
    authUrl.searchParams.set("prompt", "select_account")
  }
  window.location.href = authUrl.toString()
}
