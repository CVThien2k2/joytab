import { apiClient } from "@/api/client"

/**
 * Input: Không nhận tham số; dùng cookie `rt` hiện tại.
 * Output: Đăng xuất — BE revoke refresh token + xoá cả 2 cookie. Luôn thành công.
 *
 * Không còn hàm fetchMe/refresh ở đây: /auth/me do Next server gọi (app/(private)/page.tsx)
 * và /auth/refresh do proxy của FE + interceptor của api/client.ts tự lo.
 */
export async function logout(): Promise<void> {
  await apiClient.post("/auth/logout")
}
