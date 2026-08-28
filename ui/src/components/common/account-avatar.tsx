import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { colorFromName, initialsFromName } from "@/lib/avatar"
import { cn } from "@/lib/utils"

/**
 * Input: Tên để dựng chữ viết tắt + màu, URL ảnh (tuỳ chọn), cỡ theo px.
 * Output: Avatar tài khoản. Có ảnh thì hiện ảnh; thiếu ảnh hoặc tải lỗi thì rơi về chữ viết tắt
 *         trên nền màu suy từ tên.
 *
 *         Màu suy từ TÊN chứ không phải màu xám chung: một danh sách thành viên toàn avatar xám
 *         giống nhau thì phải đọc chữ mới phân biệt được ai, còn có màu thì mắt nhận ra trước khi
 *         đọc. Cùng bảng màu với hub nên cùng một người ở hai app ra cùng màu.
 *
 *         `size` nhận px chứ không nhận biến thể (sm/lg): các chỗ dùng cần đúng cỡ riêng (26px
 *         trong menu, 32px trong bảng, 80px ở trang cá nhân), liệt kê thành biến thể chỉ để rồi
 *         thêm biến thể mỗi lần có chỗ mới.
 *
 *         Chép khuôn từ hub (components/globals/account-avatar.tsx).
 */
export function AccountAvatar({
  name,
  src,
  size = 32,
  className,
}: {
  name: string
  src?: string | null
  size?: number
  className?: string
}) {
  return (
    <Avatar className={cn("shrink-0", className)} style={{ width: size, height: size }}>
      {src ? <AvatarImage src={src} alt="" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback
        className="font-semibold text-white"
        style={{ background: colorFromName(name), fontSize: Math.max(10, Math.round(size * 0.4)) }}
      >
        {initialsFromName(name)}
      </AvatarFallback>
    </Avatar>
  )
}
