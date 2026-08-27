"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { uploadOneImage } from "@/lib/upload"
import { UPLOAD_IMAGE_CONTENT_TYPES, UPLOAD_MAX_BYTES } from "@/schema/upload"
import type { UploadFolder } from "@/types/upload"

/**
 * Input: Tên/ảnh hiện tại, thư mục đích trên S3, và hai callback: có ảnh mới (URL) hoặc xoá ảnh.
 * Output: Avatar + nút "Đổi ảnh" / "Xoá ảnh". Chọn file là upload luôn lên S3 rồi báo URL ra
 *         ngoài — nơi dùng chỉ việc lưu URL đó.
 *
 *         Xem trước NGAY từ file vừa chọn (object URL) thay vì chờ upload xong: mạng chậm thì
 *         người dùng vẫn thấy ảnh mình chọn ngay, và tự thu hồi object URL để không rò bộ nhớ.
 *
 *         Chặn sai loại/quá dung lượng ngay tại đây, TRƯỚC khi gọi presign: S3 và BE đều chặn
 *         lần nữa, nhưng để user chờ upload 5 phút rồi mới báo "file quá lớn" là tệ.
 *
 *         Lấy ý từ hub (components/globals/avatar-upload.tsx), bỏ phần confirm dialog và
 *         `fit/shape` — ở đây chỉ có một chỗ dùng là avatar tròn.
 */
export function AvatarUpload({
  name,
  value,
  folder,
  disabled,
  onUploaded,
  onRemove,
}: {
  /** Dùng dựng chữ viết tắt khi không có ảnh. */
  name: string
  /** Ảnh hiện tại (URL), null = chưa có. */
  value: string | null
  folder: UploadFolder
  disabled?: boolean
  onUploaded: (publicUrl: string) => void
  onRemove: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)

  // Thu hồi object URL khi đổi ảnh / rời trang — không có dòng này thì mỗi lần chọn ảnh là một
  // blob nằm lại trong bộ nhớ tới khi reload trang.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const isUploading = percent !== null
  const src = preview ?? value
  const initials = initialsOf(name)

  /**
   * Input: File user vừa chọn.
   * Output: Kiểm tra, hiện xem trước, upload lên S3 rồi báo URL ra ngoài. Lỗi thì xoá xem trước
   *         để avatar không đứng ở một ảnh chưa bao giờ được lưu.
   */
  async function pick(file: File): Promise<void> {
    if (
      !UPLOAD_IMAGE_CONTENT_TYPES.includes(file.type as (typeof UPLOAD_IMAGE_CONTENT_TYPES)[number])
    ) {
      toast.error("Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF")
      return
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error(`Ảnh phải nhỏ hơn ${Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB`)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setPercent(0)

    try {
      const uploaded = await uploadOneImage({ folder, file, onProgress: setPercent })
      onUploaded(uploaded.publicUrl)
    } catch (err) {
      setPreview(null)
      URL.revokeObjectURL(objectUrl)
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại")
    } finally {
      setPercent(null)
    }
  }

  return (
    <div className="flex items-center gap-4">
      <div className="relative">
        <Avatar size="lg" className="size-16">
          {src ? <AvatarImage src={src} alt="" referrerPolicy="no-referrer" /> : null}
          <AvatarFallback className="text-base">{initials}</AvatarFallback>
        </Avatar>

        {isUploading ? (
          <div className="absolute inset-0 grid place-items-center rounded-full bg-background/70">
            <Spinner className="size-6 text-primary" />
          </div>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-col gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={UPLOAD_IMAGE_CONTENT_TYPES.join(",")}
          className="hidden"
          disabled={disabled || isUploading}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) void pick(file)
            // Xoá value để chọn LẠI cùng một file vẫn kích hoạt onChange.
            event.target.value = ""
          }}
        />

        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden="true" />
            {isUploading ? `Đang tải ${percent}%` : src ? "Đổi ảnh" : "Tải ảnh lên"}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading || !src}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => {
              setPreview(null)
              onRemove()
            }}
          >
            <Trash2 aria-hidden="true" />
            Xoá ảnh
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP hoặc GIF, tối đa {Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB. Không có
          ảnh thì hiện chữ viết tắt.
        </p>
      </div>
    </div>
  )
}

/**
 * Input: Tên (hoặc email) dùng làm nguồn.
 * Output: 1–2 ký tự viết tắt. Cùng thuật toán với UserMenu / SidebarProfileMenu / MembersTable —
 *         mọi chỗ vẽ avatar phải rơi về cùng chữ cái cho cùng một người.
 */
function initialsOf(source: string): string {
  const words = source.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return "?"
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase()
  return (words[0][0] + words[words.length - 1][0]).toUpperCase()
}
