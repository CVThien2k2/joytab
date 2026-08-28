"use client"

import { useState } from "react"
import { Menu } from "lucide-react"
import { AppSidebar } from "@/components/common/app-sidebar"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/**
 * Input: Không nhận props.
 * Output: Nút mở sidebar trên màn hình hẹp — mở đúng cái sidebar của desktop trong một tấm trượt
 *         từ mép trái.
 *
 *         CHỈ có trên mobile: nút thu/mở của desktop đã dời vào trong sidebar (xem AppSidebar),
 *         còn dưới `md` sidebar không nằm trong luồng nên phải có một đường vào từ header.
 *
 *         Dựng bằng Dialog (`side="left"`) chứ không tự làm panel: khoá focus, Esc để đóng và
 *         chặn cuộn nền là những thứ Dialog đã làm đúng — tự viết lại chỉ để có hình dáng khác là
 *         đổi ba hành vi đúng lấy một hình dáng.
 *
 *         DialogTitle bắt buộc phải có (Radix cảnh báo nếu thiếu) nhưng ở đây là chữ ẩn: tấm
 *         trượt chỉ chứa nav, đặt tiêu đề nhìn thấy được thì thừa với người dùng mắt sáng.
 */
export function SidebarDrawerButton() {
  const [open, setOpen] = useState(false)

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở menu điều hướng">
          <Menu aria-hidden="true" />
        </Button>
      </DialogTrigger>
      <DialogContent side="left" showCloseButton={false}>
        <DialogTitle className="sr-only">Điều hướng</DialogTitle>
        <AppSidebar onNavigate={() => setOpen(false)} />
      </DialogContent>
    </Dialog>
  )
}
