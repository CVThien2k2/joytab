import axios from "axios"

/** Envelope lỗi của BE (api/src/common/utils/types.ts). */
type ApiErrorBody = {
  code?: string
  message?: string
  /** Chỉ có với lỗi validate: mảng message của ValidationPipe. */
  details?: unknown
}

/**
 * Input: Lỗi bất kỳ từ axios/zod + message hiện khi không đọc được gì cụ thể.
 * Output: Câu tiếng Việt để đưa vào toast.
 *
 * Ưu tiên `details` trước `message`: với lỗi 400 do ValidationPipe, `message` chỉ là
 * "Bad Request" chung chung còn `details` mới nói rõ field nào sai.
 */
export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (!axios.isAxiosError(error)) return fallback

  const body = error.response?.data as ApiErrorBody | undefined
  if (Array.isArray(body?.details)) {
    // Bỏ trùng: một field sai có thể vi phạm nhiều decorator cùng lúc (vd "abc" cho `age`
    // trượt cả @Min lẫn @Max lẫn @IsInt) và class-validator trả từng cái một.
    const messages = [
      ...new Set(body.details.filter((item): item is string => typeof item === "string")),
    ]
    if (messages.length > 0) return messages.join(". ")
  }
  if (typeof body?.message === "string" && body.message.trim()) return body.message

  // Không có response = không tới được BE (mất mạng, BE chết) — nói đúng chuyện đó.
  if (!error.response) return "Không kết nối được máy chủ. Vui lòng thử lại."

  return fallback
}
