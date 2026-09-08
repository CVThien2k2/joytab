"use client"

import { ProfileForm } from "@/components/common/profile-form"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

/**
 * Input: trạng thái mở.
 * Output: Hộp thoại thông tin cá nhân — ảnh đại diện và form tên/tuổi/giới tính/SĐT. Thay hẳn
 *         cho trang `/me` cũ, không còn một trang nào cho hồ sơ nữa.
 *
 *         Là hộp thoại chứ không phải trang vì đây là chỗ người ta ghé rồi đi ngay: sửa số điện
 *         thoại xong là quay lại việc đang làm. Một trang riêng bắt họ rời khỏi màn hình đang
 *         làm việc rồi tự tìm đường về, mà đường về thì mỗi lúc một khác — vào từ lịch thì phải
 *         về lịch, vào từ thanh toán thì phải về thanh toán.
 *
 *         Không có khu chọn giao diện ở đây: menu tài khoản ở sidebar đã có sẵn, mà hộp thoại
 *         này chỉ nói về HỒ SƠ — thứ thuộc về tài khoản và theo người dùng sang mọi máy. Cài
 *         đặt sáng/tối thì ngược lại, chỉ đúng cho thiết bị đang ngồi.
 *
 *         `DialogContent` để nguyên lề mặc định, không `p-0` như bản trước: `DialogFooter` của
 *         dự án kéo âm `-mx-4 -mb-4` để dải nền chân hộp ăn sát mép — bỏ lề của hộp thì cú kéo
 *         đó lôi chân hộp ra NGOÀI khung. Chân hộp chuẩn đi kèm khung chuẩn, không tách được.
 *
 *         Phần ruột cuộn và hàng nút nằm trong `ProfileForm` chứ không ở đây: hai nút phải đọc
 *         được `isDirty` và bắn `submit` của chính form đó. Form bọc ngoài bằng `contents` nên
 *         `DialogBody` và `DialogFooter` vẫn là con trực tiếp của lưới ba hàng — đầu và chân
 *         đứng yên, chỉ khúc giữa trượt. Đúng cách các hộp thoại có form khác trong dự án dựng.
 */
export function ProfileDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thông tin cá nhân</DialogTitle>
        </DialogHeader>

        <ProfileForm />
      </DialogContent>
    </Dialog>
  )
}
