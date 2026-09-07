import { apiClient } from "@/api/client"
import { meResponseSchema } from "@/schema/auth"
import type { CurrentUser } from "@/types/auth"
import type { UpdateProfilePayload } from "@/types/profile"

/**
 * Input: Không nhận tham số; dùng cookie `at` hiện tại.
 * Output: User đang đăng nhập. Đây là lượt gọi bootstrap của cả khu đã đăng nhập (SessionGate),
 *         chạy ở CLIENT — không còn server component nào gọi /auth/me.
 *
 *         Không tự xử lý 401: apiClient xoay token rồi chạy lại request này, xoay hỏng thì đưa
 *         về /logout.
 */
export async function fetchMe(): Promise<CurrentUser> {
  const response = await apiClient.get("/auth/me")
  return meResponseSchema.parse(response.data).data
}

/**
 * Input: Không nhận tham số; dùng cookie `rt` hiện tại.
 * Output: Đăng xuất — BE revoke refresh token + xoá cookie phiên. Luôn thành công.
 *
 * Chỉ trang /logout gọi hàm này; /auth/refresh do interceptor của api/client.ts tự lo.
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
