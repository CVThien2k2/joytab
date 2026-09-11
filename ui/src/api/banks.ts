import { apiClient } from "@/api/client"
import { bankListResponseSchema } from "@/schema/bank"
import type { Bank } from "@/types/bank"

/**
 * Input: Không nhận tham số.
 * Output: Các ngân hàng nhận được chuyển khoản, đã sắp theo tên ngắn ở BE.
 *
 *         BE lấy từ VietQR và cache 24h, hỏng thì trả danh sách bundle sẵn — nên lượt gọi này
 *         không bao giờ hỏng vì lý do "VietQR đang sập", và FE không cần đường lùi riêng.
 */
export async function fetchBanks(): Promise<Bank[]> {
  const response = await apiClient.get("/banks")
  return bankListResponseSchema.parse(response.data).data.banks
}
