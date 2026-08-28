"use client"

import { OrganizationAccessCard } from "@/app/(private)/_components/organization-access-card"
import { useActiveOrganization } from "@/providers/organization-store-provider"
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
 *         Member thấy ĐỦ mọi thông tin của tổ chức — tên, hệ số chia tiền, mã mời, mã QR. Cái
 *         họ không có là các nút ĐỔI những thứ đó. Giấu bớt thông tin chỉ khiến họ phải đi hỏi
 *         owner những câu mà màn hình trả lời được.
 */
export default function OrganizationPage() {
  const organization = useActiveOrganization()
  const isOwner = organization.role === "owner"

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
