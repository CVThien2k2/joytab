"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { OrganizationAccessCard } from "@/app/(private)/_components/organization-access-card"
import { organizationHomePath } from "@/lib/routes"
import { useActiveOrganization } from "@/stores/organization-store"
import { MembersTable } from "./_components/members-table"
import { OrganizationDangerZone } from "./_components/organization-danger-zone"
import { OrganizationInfoCard } from "./_components/organization-info-card"

/**
 * Input: Không nhận props — tổ chức đang xem lấy từ store (layout đã fetch và khớp với URL).
 * Output: Trang duy nhất của một tổ chức: thông tin + cấu hình + danh sách thành viên + hành
 *         động rời/xoá.
 *
 *         MỘT trang chứ không tách tab: mỗi phần chỉ vài dòng, tách ra thì người dùng phải bấm
 *         qua lại để nắm được một thứ duy nhất là "tổ chức này đang thế nào".
 *
 *         Bố cục là các THẺ RỜI xếp theo lưới, không còn là một thẻ dài xâu mọi khối theo
 *         chiều dọc: cách cũ khiến mỗi khối chiếm trọn bề ngang chỉ để chứa hai dòng chữ, phần
 *         còn lại của màn hình bỏ trống mà trang thì vẫn phải cuộn.
 *
 *         Là client component: tổ chức đọc từ store (server đã fetch ở layout), còn danh sách
 *         thành viên do React Query lấy — xem MembersTable.
 *
 *         CHỈ owner vào được. Cả trang này là chỗ đọc và đổi cấu hình tổ chức cùng danh sách
 *         thành viên — việc của chủ tổ chức. Member bị đá về lịch thi đấu: sidebar đã không còn
 *         mục "Tổ chức", nhưng đường dẫn cũ trong bookmark hay link dán cho nhau thì vẫn tới
 *         đây, mà ẩn khỏi nav trong khi URL vẫn mở được thì việc ẩn chỉ là trang trí.
 *
 *         Đá bằng `replace` trong effect, không phải lúc render: đổi route ngay trong thân
 *         component là ghi state của router trong lúc React đang render cây khác. `replace` chứ
 *         không `push` để Back không rơi lại đúng trang vừa bị đá đi.
 */
export default function OrganizationPage() {
  const router = useRouter()
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"

  useEffect(() => {
    if (!isOwner) router.replace(organizationHomePath(organization.id))
  }, [isOwner, organization.id, router])

  // Không render gì trong lúc chờ effect đá đi: hiện thoáng qua danh sách thành viên rồi mới
  // chuyển trang thì đúng cái cần giấu lại là cái loé lên.
  if (!isOwner) return null

  return (
    <main className="mx-auto w-full max-w-7xl flex-1 space-y-4 px-4 py-6 sm:px-6">
      {/* Thẻ đầu chạy suốt chiều ngang vì nó là tiêu đề của cả trang. */}
      <OrganizationInfoCard organization={organization} />

      {/* Mã mời chạy suốt chiều ngang: nó là một hàng gồm mã + hai nút sao chép, chia đôi
          hàng thì mã và nút phải xuống dòng mà nửa còn lại vẫn trống.

          Mã QR không còn thẻ riêng — nó thu về một ô nhỏ ở góc thẻ thông tin (xem
          PaymentQrButton): thứ mỗi tháng dùng vài lần không đáng chiếm nửa hàng trên trang. */}
      <OrganizationAccessCard organization={organization} />

      {/* Danh sách thành viên là thứ dài nhất và là thứ người ta vào trang này để xem, nên nằm
          ngay sau phần cấu hình và giữ trọn chiều ngang — bảng cần bề rộng. */}
      <section className="pt-2">
        <h2 className="text-base font-semibold tracking-tight">Thành viên</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {organization.memberCount} người trong tổ chức, chủ tổ chức xếp trước.
        </p>

        <div className="mt-3">
          <MembersTable organizationId={organization.id} isOwner={isOwner} />
        </div>
      </section>

      <OrganizationDangerZone organization={organization} />
    </main>
  )
}
