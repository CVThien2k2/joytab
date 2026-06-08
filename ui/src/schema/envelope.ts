import { z } from "zod"

/**
 * Input: Schema cho phần `data` của response.
 * Output: Schema bọc theo envelope chuẩn { success, message, data } của BE.
 */
export function envelope<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    message: z.string(),
    data: dataSchema,
  })
}
