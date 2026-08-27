"use client"

import { useState } from "react"
import { PanelLeft } from "lucide-react"
import { AppSidebar } from "@/components/common/app-sidebar"
import { useSidebar } from "@/components/common/sidebar-provider"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

/**
 * Input: Không nhận props.
 * Output: Nút thu/mở sidebar ở góc trái header. Người dùng thấy MỘT nút, thực tế là hai nút
 *         loại trừ nhau theo bề rộng màn hình:
 *  - Dưới `md`: mở sidebar trong tấm trượt từ mép trái (sidebar không có chỗ trong luồng).
 *  - Từ `md`: thu/giãn cột sidebar.
 *
 *         Tách theo breakpoint bằng class chứ không đo bằng matchMedia: đo bằng JS thì lần
 *         render đầu (trên server) chưa biết bề rộng nên luôn phải đoán sai một lần rồi sửa,
 *         thấy được thành một nhịp nháy.
 *
 *         Dialog lo khoá focus, Esc để đóng và chặn cuộn nền — tự viết panel là đổi ba hành vi
 *         đúng lấy một hình dáng.
 */
export function SidebarToggle() {
  const { open, toggle } = useSidebar()
  const [drawerOpen, setDrawerOpen] = useState(false)

  return (
    <>
      <Dialog open={drawerOpen} onOpenChange={setDrawerOpen}>
        <DialogTrigger asChild>
          <Button variant="ghost" size="icon" className="md:hidden" aria-label="Mở menu điều hướng">
            <PanelLeft aria-hidden="true" />
          </Button>
        </DialogTrigger>
        <DialogContent side="left" showCloseButton={false}>
          <DialogTitle className="sr-only">Điều hướng</DialogTitle>
          <AppSidebar onNavigate={() => setDrawerOpen(false)} />
        </DialogContent>
      </Dialog>

      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="hidden md:inline-flex"
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? "Thu gọn thanh điều hướng" : "Mở thanh điều hướng"}
      >
        <PanelLeft aria-hidden="true" />
      </Button>
    </>
  )
}
