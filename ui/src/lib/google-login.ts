import { apiClient } from "@/api/client"

/**
 * Input: selectAccount=true khi muốn ép Google hiện màn chọn tài khoản (luồng thêm tài khoản);
 *        returnTo là path cần quay lại sau khi đăng nhập xong (vd /join/ABCD1234).
 * Output: Chuyển hướng browser sang BE /auth/google để bắt đầu OAuth.
 *
 *         `returnTo` được BE nhét vào `state` của OAuth và Google trả lại nguyên xi ở
 *         callback, nên đích cuối sống sót qua cả vòng chuyển hướng ra ngoài rồi về. BE lọc
 *         giá trị này ở cả hai đầu; ở đây chỉ gửi đi.
 */
export function redirectToGoogleLogin(options?: {
  selectAccount?: boolean
  returnTo?: string | null
}): void {
  const apiBaseUrl = apiClient.defaults.baseURL ?? "http://localhost:8000"
  const authUrl = new URL("/auth/google", apiBaseUrl)
  if (options?.selectAccount) {
    authUrl.searchParams.set("prompt", "select_account")
  }
  if (options?.returnTo) {
    authUrl.searchParams.set("returnTo", options.returnTo)
  }
  window.location.href = authUrl.toString()
}
