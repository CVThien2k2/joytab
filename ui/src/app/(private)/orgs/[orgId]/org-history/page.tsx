"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { organizationHomePath } from "@/lib/routes"
import { useActiveOrganization } from "@/stores/organization-store"
import { OrgHistoryList } from "./_components/org-history-list"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch, khớp với URL).
 * Output: Trang Lịch sử tổ chức: mọi buổi đã qua CỦA CẢ TỔ CHỨC, kèm tổng tiền và tiến độ thu
 *         của từng buổi.
 *
 *         Là sổ ĐIỀU HÀNH, đứng riêng với "Trận của tôi": hai trang cắt cùng một tập buổi đã
 *         qua theo hai câu hỏi khác nhau. Bên kia là "mình đã đá buổi nào, còn nợ buổi nào" —
 *         chỉ buổi mình có mặt, chỉ tiền của mình. Bên này là "tổ chức còn buổi nào chưa chốt
 *         giá, buổi nào chưa thu hết tiền" — mọi buổi, tiền của cả buổi.
 *
 *         Vì vậy nó cũng là một danh sách VIỆC chứ không phải chỗ tra cứu: mỗi dòng có nút
 *         sang trang chi tiết, nơi chốt được giá và xem được ai đã trả.
 *
 *         Không có dải nhắc nợ như trang kia: dải đó nói về tiền CỦA MÌNH, mà ở đây người xem
 *         đang đứng ở vai người đi thu.
 *
 *         CHỈ owner vào được. Member bị đá về trang chủ: sidebar đã không hiện mục này, nhưng
 *         đường dẫn cũ trong bookmark hay link dán cho nhau thì vẫn tới đây — mà ẩn khỏi nav
 *         trong khi URL vẫn mở được thì việc ẩn chỉ là trang trí. API cũng chặn (ORG_004), nên
 *         đây chỉ là lớp ngoài cho đỡ khó hiểu.
 *
 *         Đá bằng `replace` trong effect, không phải lúc render: đổi route ngay trong thân
 *         component là ghi state của router trong lúc React đang render cây khác. `replace`
 *         chứ không `push` để Back không rơi lại đúng trang vừa bị đá đi. Cùng khuôn với trang
 *         cấu hình tổ chức.
 */
export default function OrganizationHistoryPage() {
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"

  useEffect(() => {
    if (!isOwner) router.replace(organizationHomePath(organization.id))
  }, [isOwner, organization.id, router])

  // Không render gì trong lúc chờ effect đá đi: loé lên một danh sách tiền của cả tổ chức rồi
  // mới chuyển trang thì đúng cái cần giấu lại là cái người ta kịp đọc.
  if (!isOwner) return null

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:px-6">
      {/* Không lặp lại tên trang: breadcrumb trên thanh header đã nói. */}
      <OrgHistoryList organizationId={organization.id} />
    </main>
  )
}
