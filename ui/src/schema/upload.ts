import { z } from "zod"
import { envelope } from "@/schema/envelope"

/** Thư mục đích trên S3 — khớp allowlist ở BE (api/src/upload/upload.constants.ts). */
export const UPLOAD_FOLDERS = ["avatars", "org-logos", "payment-qr", "payment-proofs"] as const
export const uploadFolderSchema = z.enum(UPLOAD_FOLDERS)

/** Loại ảnh BE nhận. Khớp UPLOAD_IMAGE_CONTENT_TYPES ở BE — lệch nhau thì BE trả 400. */
export const UPLOAD_IMAGE_CONTENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
] as const

/** Dung lượng tối đa mỗi ảnh (5MB) — mirror của UPLOAD_MAX_BYTES ở BE, S3 mới là chỗ chặn thật. */
export const UPLOAD_MAX_BYTES = 5 * 1024 * 1024

/**
 * Kết quả presigned POST. `fields` là các field policy S3 bắt buộc gửi kèm và phải đứng TRƯỚC
 * field `file` trong FormData — xem lib/upload.ts.
 */
export const presignedPostSchema = z.object({
  url: z.string(),
  fields: z.record(z.string(), z.string()),
  key: z.string(),
  publicUrl: z.string(),
})

/** POST /upload/presign */
export const presignedPostResponseSchema = envelope(presignedPostSchema)
