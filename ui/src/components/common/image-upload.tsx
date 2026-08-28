"use client"

import { useEffect, useRef, useState } from "react"
import { Camera, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { AccountAvatar } from "@/components/common/account-avatar"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { uploadOneImage } from "@/lib/upload"
import { cn } from "@/lib/utils"
import { UPLOAD_IMAGE_CONTENT_TYPES, UPLOAD_MAX_BYTES } from "@/schema/upload"
import type { UploadFolder } from "@/types/upload"

/** Cạnh mặc định của khung xem trước (px). Đủ nhìn rõ mặt người hoặc quét thử một mã QR. */
const DEFAULT_SIZE = 64

const MAX_MB = Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)

export type ImageUploadProps = {
  /** Ảnh hiện tại (URL công khai), null = chưa có. */
  value: string | null
  folder: UploadFolder
  /**
   * `circle` = ảnh đại diện, thiếu ảnh thì rơi về chữ viết tắt trên nền màu (cần `name`).
   * `square` = ảnh phải nhìn được nội dung (mã QR, biên lai chuyển khoản) nên giữ nguyên tỉ lệ
   * trong một khung vuông có viền.
   */
  shape?: "circle" | "square"
  /** Dựng chữ viết tắt cho `circle`, và làm `alt` cho `square`. */
  name?: string
  /** Nhãn nút khi chưa có ảnh. */
  label?: string
  size?: number
  /**
   * Ẩn khung xem trước, chỉ để lại hai cái nút. Dùng khi nơi gọi ĐÃ hiện ảnh ở khổ lớn — hai
   * bản của cùng một ảnh trong một hộp thoại thì bản nhỏ chỉ làm rối.
   */
  hidePreview?: boolean
  disabled?: boolean
  /** Tiêu đề và nội dung hộp thoại xác nhận xoá — mỗi chỗ mất một thứ khác nhau. */
  removeTitle?: string
  removeDescription?: string
  onUploaded: (publicUrl: string) => void
  onRemove: () => void
}

/**
 * Input: ảnh hiện tại, thư mục đích trên S3, hình dạng khung, và hai callback (có ảnh mới / gỡ ảnh).
 * Output: Khung xem trước + nút đổi ảnh + nút xoá ảnh (có xác nhận).
 *
 *         MỘT component cho mọi chỗ tải ảnh của app: ảnh đại diện, mã QR của tổ chức, ảnh
 *         chuyển khoản. Trước đây là hai component gần giống nhau, và chúng đã bắt đầu lệch —
 *         một cái có xác nhận trước khi xoá, cái kia xoá thẳng.
 *
 *         Xem trước NGAY từ file vừa chọn (object URL) thay vì chờ upload xong: mạng chậm thì
 *         vẫn thấy ảnh mình chọn, và tự thu hồi object URL để không rò bộ nhớ.
 *
 *         Chặn sai loại/quá dung lượng TRƯỚC khi gọi presign: S3 và BE đều chặn lần nữa, nhưng
 *         bắt chờ tải xong 5MB rồi mới báo "file quá lớn" là tệ.
 *
 *         Xoá luôn phải qua hộp thoại: ảnh đã nằm trên S3 và cái nút này gỡ nó khỏi nơi đang
 *         dùng ngay lập tức, không có đường hoàn lại. Đổi ảnh thì không hỏi — chọn sai chỉ việc
 *         chọn lại.
 */
export function ImageUpload({
  value,
  folder,
  shape = "circle",
  name = "",
  label = "Tải ảnh lên",
  size = DEFAULT_SIZE,
  hidePreview = false,
  disabled,
  removeTitle = "Xoá ảnh?",
  removeDescription = "Ảnh sẽ bị gỡ ngay và không lấy lại được.",
  onUploaded,
  onRemove,
}: ImageUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [percent, setPercent] = useState<number | null>(null)
  const [confirmingRemove, setConfirmingRemove] = useState(false)

  // Thu hồi object URL khi đổi ảnh / rời trang — không có dòng này thì mỗi lần chọn ảnh là một
  // blob nằm lại trong bộ nhớ tới khi reload trang.
  useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  }, [preview])

  const isUploading = percent !== null
  const src = preview ?? value

  async function pick(file: File): Promise<void> {
    if (
      !UPLOAD_IMAGE_CONTENT_TYPES.includes(file.type as (typeof UPLOAD_IMAGE_CONTENT_TYPES)[number])
    ) {
      toast.error("Chỉ nhận ảnh JPEG, PNG, WebP hoặc GIF")
      return
    }
    if (file.size > UPLOAD_MAX_BYTES) {
      toast.error(`Ảnh phải nhỏ hơn ${MAX_MB}MB`)
      return
    }

    const objectUrl = URL.createObjectURL(file)
    setPreview(objectUrl)
    setPercent(0)

    try {
      const uploaded = await uploadOneImage({ folder, file, onProgress: setPercent })
      onUploaded(uploaded.publicUrl)
    } catch (err) {
      // Xoá xem trước để khung không đứng ở một ảnh chưa bao giờ được lưu.
      setPreview(null)
      URL.revokeObjectURL(objectUrl)
      toast.error(err instanceof Error ? err.message : "Tải ảnh lên thất bại")
    } finally {
      setPercent(null)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      {hidePreview ? null : (
        <div className="relative shrink-0" style={{ width: size, height: size }}>
          {shape === "circle" ? (
            <AccountAvatar name={name} src={src} size={size} />
          ) : (
            <div className="size-full overflow-hidden rounded-lg border bg-muted">
              {src ? (
                // Thẻ <img> chứ không next/image: ảnh nằm trên bucket S3, mà host của bucket khác
                // nhau giữa dev (LocalStack) và prod — khai remotePatterns cứng ở next.config là
                // buộc đổi config mỗi lần đổi hạ tầng.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt={name || label} className="size-full object-contain" />
              ) : (
                <div className="grid size-full place-items-center px-1 text-center text-[11px] leading-tight text-muted-foreground">
                  Chưa có ảnh
                </div>
              )}
            </div>
          )}

          {isUploading ? (
            <div
              className={cn(
                "absolute inset-0 grid place-items-center bg-background/70",
                shape === "circle" ? "rounded-full" : "rounded-lg",
              )}
            >
              <Spinner className="size-5 text-primary" />
            </div>
          ) : null}
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col gap-1.5">
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

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => inputRef.current?.click()}
          >
            <Camera aria-hidden="true" />
            {isUploading ? `Đang tải ${percent}%` : src ? "Đổi ảnh" : label}
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled || isUploading || !src}
            className="text-destructive hover:bg-destructive/10 hover:text-destructive"
            onClick={() => setConfirmingRemove(true)}
          >
            <Trash2 aria-hidden="true" />
            Xoá ảnh
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP hoặc GIF, tối đa {MAX_MB}MB.
        </p>
      </div>

      <Dialog
        open={confirmingRemove}
        onOpenChange={(open) => {
          if (!disabled) setConfirmingRemove(open)
        }}
      >
        <DialogContent className="sm:max-w-md" showCloseButton={false}>
          <DialogHeader>
            <div className="flex size-11 items-center justify-center rounded-full bg-destructive/10 text-destructive">
              <Trash2 className="size-5" aria-hidden="true" />
            </div>
            <DialogTitle className="mt-3">{removeTitle}</DialogTitle>
            <DialogDescription>{removeDescription}</DialogDescription>
          </DialogHeader>

          <DialogFooter className="mt-5">
            <Button
              type="button"
              variant="outline"
              disabled={disabled}
              onClick={() => setConfirmingRemove(false)}
            >
              Huỷ
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={disabled}
              onClick={() => {
                setConfirmingRemove(false)
                setPreview(null)
                onRemove()
              }}
            >
              <Trash2 aria-hidden="true" />
              Xoá ảnh
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
