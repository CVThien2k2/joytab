"use client"

import { useState } from "react"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { MatchFormDialog } from "./match-form-dialog"

/**
 * Input: id tổ chức.
 * Output: Nút "Tạo lịch" kèm hộp thoại của nó. Chỉ owner mới được dựng nút này — phía gọi
 *         quyết định, ở đây không kiểm quyền lần nữa (BE mới là hàng rào thật).
 *
 *         Gói nút + hộp thoại vào một chỗ vì trạng thái `open` chỉ có ý nghĩa với đúng cặp đó:
 *         để nó ở trang thì trang phải giữ một ô state chẳng liên quan gì tới phần còn lại.
 */
export function CreateMatchButton({ organizationId }: { organizationId: string }) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" />
        Tạo lịch
      </Button>

      <MatchFormDialog organizationId={organizationId} open={open} onOpenChange={setOpen} />
    </>
  )
}
