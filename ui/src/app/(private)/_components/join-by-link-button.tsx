"use client"

import { useRouter } from "next/navigation"
import { LogIn } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useJoinOrganization } from "@/hooks/use-organizations-api"
import { normalizeJoinCode } from "@/schema/organization"

/**
 * Input: Mã tham gia lấy từ URL của link mời.
 * Output: Nút "Tham gia ngay" — dùng lại đúng mutation của dialog nhập mã, nên toast, cách
 *         làm mới dữ liệu và xử lý lỗi giống hệt nhau.
 *
 *         Chuẩn hoá mã ngay tại đây vì link có thể được chép tay lệch hoa/thường: BE cũng
 *         chuẩn hoá lần nữa, nhưng gửi đi đúng dạng thì lỗi trả về mới đúng nghĩa.
 *
 *         Vào xong thì `onSuccess` của hook đã `router.refresh()`, còn điều hướng về `/` để
 *         user thấy ngay tổ chức vừa vào thay vì ngồi lại trang mời.
 */
export function JoinByLinkButton({ joinCode }: { joinCode: string }) {
  const router = useRouter()
  // `replace` chứ không `push`: bấm Back sau khi đã vào tổ chức mà quay lại trang mời thì chỉ
  // thấy "bạn đã ở trong tổ chức này" — một bước thừa không nói thêm được gì.
  const mutation = useJoinOrganization(() => router.replace("/"))

  return (
    <Button
      type="button"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate({ joinCode: normalizeJoinCode(joinCode) })}
    >
      <LogIn aria-hidden="true" />
      {mutation.isPending ? "Đang tham gia" : "Tham gia ngay"}
    </Button>
  )
}
