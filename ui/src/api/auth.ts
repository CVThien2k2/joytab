import { apiClient } from "@/api/client"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"

/**
 * Input: Không nhận tham số; dùng cookie `rt` hiện tại.
 * Output: Đăng xuất — BE revoke refresh token + xoá cả 2 cookie. Luôn thành công.
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
}

/**
 * Input: Không nhận tham số; dùng cookie `at`.
 * Output: Thông tin user hiện tại. Chỉ gọi ở trang /login/callback ngay sau khi login.
 */
export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiClient.get("/auth/me")
  return meResponseSchema.parse(response.data).data
}

/**
 * Input: Không nhận tham số; dùng cookie `rt`.
 * Output: Xoay vòng refresh token, BE set lại cookie `at`/`rt`, trả user hiện tại.
 *         Bình thường interceptor ở api/client.ts tự gọi; hàm này để dùng trực tiếp khi cần.
 */
export async function refresh(): Promise<CurrentUser> {
  const response = await apiClient.post("/auth/refresh")
  return meResponseSchema.parse(response.data).data
}
