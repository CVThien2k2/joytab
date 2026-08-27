import { apiClient } from "@/api/client"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"
import type { UpdateProfilePayload } from "@/types/profile"

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

/**
 * Input: Các field cần đổi. Field không gửi = giữ nguyên; `avatarUrl: null` = xoá ảnh.
 * Output: User sau khi cập nhật, cùng shape /auth/me nên gọi xong bơm thẳng vào store được.
 *
 *         KHÔNG gửi file ở đây: ảnh đi trực tiếp lên S3 bằng presigned POST (lib/upload.ts),
 *         hàm này chỉ lưu địa chỉ ảnh.
 */
export async function updateProfile(payload: UpdateProfilePayload): Promise<CurrentUser> {
  const response = await apiClient.patch("/auth/me", payload)
  return meResponseSchema.parse(response.data).data
}
