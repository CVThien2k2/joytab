import { presignUpload } from "@/api/upload"
import type { UploadFolder } from "@/types/upload"

/** Ảnh đã upload: URL công khai để lưu/hiển thị + key S3 để xoá về sau. */
export type UploadedImage = {
  publicUrl: string
  key: string
}

/**
 * Input: URL presigned, các field policy, và file.
 * Output: Promise xong khi S3 nhận file.
 *
 *         Dùng XMLHttpRequest chứ không fetch: chỉ XHR báo được tiến độ upload (`upload.onprogress`),
 *         mà ảnh 5MB trên mạng chậm thì thanh tiến độ là khác biệt giữa "đang chạy" và "treo".
 *
 *         Thứ tự field trong FormData KHÔNG được đổi: S3 yêu cầu mọi field policy đứng trước, và
 *         `file` phải là field CUỐI cùng — sai thứ tự thì S3 trả 400 với thông báo rất khó hiểu.
 *
 *         Chép từ hub (apps/hub-ui/lib/upload.ts).
 */
function postToPresignedUrl(params: {
  url: string
  fields: Record<string, string>
  file: File
  onProgress?: (percent: number) => void
}): Promise<void> {
  return new Promise((resolve, reject) => {
    const form = new FormData()
    for (const [key, value] of Object.entries(params.fields)) form.append(key, value)
    form.append("file", params.file)

    const xhr = new XMLHttpRequest()
    xhr.open("POST", params.url, true)

    xhr.upload.onprogress = (event) => {
      if (!params.onProgress) return
      const total = event.total || params.file.size || 0
      params.onProgress(total > 0 ? Math.min(100, Math.round((event.loaded / total) * 100)) : 0)
    }

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve()
      reject(new Error(`Tải ảnh lên thất bại (${xhr.status})`))
    }
    xhr.onerror = () => reject(new Error("Tải ảnh lên thất bại: không kết nối được"))
    xhr.onabort = () => reject(new Error("Đã huỷ tải ảnh"))

    xhr.send(form)
  })
}

/**
 * Input: thư mục đích, file ảnh, callback tiến độ (tuỳ chọn).
 * Output: `publicUrl` (lưu vào DB / hiển thị) và `key` (để xoá khi cần).
 *
 *         Hai bước: xin presign ở API rồi POST file thẳng lên S3. API không nhìn thấy byte nào,
 *         nên file 5MB không chiếm RAM lẫn connection của Node.
 */
export async function uploadOneImage(params: {
  folder: UploadFolder
  file: File
  onProgress?: (percent: number) => void
}): Promise<UploadedImage> {
  const presigned = await presignUpload({
    folder: params.folder,
    filename: params.file.name,
    contentType: params.file.type,
  })

  await postToPresignedUrl({
    url: presigned.url,
    fields: presigned.fields,
    file: params.file,
    onProgress: params.onProgress,
  })

  return { publicUrl: presigned.publicUrl, key: presigned.key }
}
