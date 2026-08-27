import { apiClient } from "@/api/client"
import { presignedPostResponseSchema } from "@/schema/upload"
import type { PresignedPost, UploadFolder } from "@/types/upload"

/**
 * Input: thư mục đích, tên tệp gốc, loại MIME.
 * Output: URL + fields để POST ảnh thẳng lên S3.
 *
 *         Chỉ xin QUYỀN ghi, chưa gửi byte nào: file không đi qua API (xem lib/upload.ts).
 */
export async function presignUpload(payload: {
  folder: UploadFolder
  filename: string
  contentType: string
}): Promise<PresignedPost> {
  const response = await apiClient.post("/upload/presign", payload)
  return presignedPostResponseSchema.parse(response.data).data
}

/**
 * Input: key S3 của ảnh.
 * Output: Không trả gì. Dùng để dọn ảnh mồ côi — user upload xong rồi bấm Huỷ thì file đã nằm
 *         trên S3 nhưng không ai tham chiếu tới.
 */
export async function deleteUpload(key: string): Promise<void> {
  await apiClient.delete(`/upload?key=${encodeURIComponent(key)}`)
}
