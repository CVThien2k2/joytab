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
import { UPLOAD_IMAGE_CONTENT_TYPES, UPLOAD_MAX_BYTES } from "@/schema/upload"
import type { UploadFolder } from "@/types/upload"

/** Cạnh avatar ở trang thông tin cá nhân (px). To hơn mọi chỗ khác vì đây là chỗ NGẮM ảnh. */
const AVATAR_SIZE = 88

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
 *         Xoá ảnh phải qua hộp thoại xác nhận: nó ghi thẳng lên DB ngay khi bấm (không chờ
 *         "Lưu"), và ảnh cũ trên S3 bị xoá luôn — không có đường hoàn lại. Đổi ảnh thì không cần
 *         hỏi, vì chọn sai chỉ việc chọn lại.
 *
 *         Lấy ý từ hub (components/globals/avatar-upload.tsx), bỏ phần `fit/shape` — ở đây chỉ có
 *         một chỗ dùng là avatar tròn.
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
        <AccountAvatar name={name} src={src} size={AVATAR_SIZE} />

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
            onClick={() => setConfirmingRemove(true)}
          >
            <Trash2 aria-hidden="true" />
            Xoá ảnh
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          JPEG, PNG, WebP hoặc GIF, tối đa {Math.round(UPLOAD_MAX_BYTES / 1024 / 1024)}MB.
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
            <DialogTitle className="mt-3">Xoá ảnh đại diện?</DialogTitle>
            <DialogDescription>
              Ảnh sẽ bị xoá ngay và không lấy lại được. Chỗ nào đang hiện ảnh của bạn sẽ chuyển về
              chữ viết tắt trên nền màu.
            </DialogDescription>
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
