"use client"

import { useState } from "react"
import { CalendarDays, Pencil, Scale, Users } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/format"
import type { Organization } from "@/types/organization"
import { EditOrganizationDialog } from "./edit-organization-dialog"
import { PaymentQrButton } from "./payment-qr-button"

/**
 * Input: Tổ chức đang xem.
 * Output: Khối thông tin tổ chức: tên (kèm nút sửa cho owner ngay bên cạnh), rồi hàng badge
 *         gồm vai trò, số thành viên, ngày bạn vào và hệ số chia tiền. Mã QR thu nhỏ nằm ở
 *         góc phải.
 *
 *         Nút sửa CHỈ hiện với owner: member gọi PATCH sẽ ăn ORG_004, hiện nút cho họ là hứa một
 *         việc không làm được.
 *
 *         Là một THẺ độc lập, chạy suốt chiều ngang ở đầu trang — nó là tiêu đề của cả trang
 *         chứ không phải một mục ngang hàng với những mục còn lại.
 */
export function OrganizationInfoCard({ organization }: { organization: Organization }) {
  const [editing, setEditing] = useState(false)
  const isOwner = organization.role === "owner"

  return (
    <>
      <section className="relative rounded-xl border bg-card p-4">
        {/* pr chừa chỗ cho ô QR định vị tuyệt đối bên phải — không có nó thì badge chạy xuống
            dưới ảnh. Chừa cả khi không có QR cũng không sao: đó chỉ là lề phải rộng hơn. */}
        <div className="pr-20 sm:pr-24">
          {/* Nút sửa đứng NGAY CẠNH tên: nó sửa chính cái tên đó (và hệ số ngay bên dưới), nên
              để nó dạt sang mép phải là bắt mắt đi hết một hàng mới tìm ra thứ mình cần bấm. */}
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="min-w-0 truncate text-base font-semibold tracking-tight">
              {organization.name}
            </h2>

            {isOwner ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0"
                onClick={() => setEditing(true)}
              >
                <Pencil aria-hidden="true" />
                Sửa thông tin
              </Button>
            ) : null}
          </div>

          <div className="mt-2.5 flex flex-wrap items-center gap-2">
            <Badge variant={isOwner ? "default" : "secondary"}>
              {isOwner ? "Chủ tổ chức" : "Thành viên"}
            </Badge>
            <Badge variant="outline">
              <Users aria-hidden="true" />
              {organization.memberCount} thành viên
            </Badge>
            <Badge variant="outline">
              <CalendarDays aria-hidden="true" />
              Bạn vào ngày {formatDate(organization.joinedAt)}
            </Badge>
            {/* Hệ số quyết định mình đóng bao nhiêu mỗi buổi, nên là thông tin của MỌI thành
                  viên — hiện ngay đây, còn sửa thì nằm trong hộp thoại của owner. */}
            <Badge variant="outline">
              <Scale aria-hidden="true" />
              Nam ×{organization.maleRatio} · nữ ×1
            </Badge>
          </div>
        </div>
        {/* ĐỊNH VỊ TUYỆT ĐỐI, không phải flex item.

            Trong một hàng có `flex-wrap`, `self-stretch` + `aspect-square` tạo phụ thuộc vòng:
            chiều cao dòng suy từ item, mà item lại suy chiều cao từ dòng. Trình duyệt gỡ vòng
            bằng kích thước nội dung, và cái ảnh `size-full` bên trong thì không có kích thước
            nội dung — kết quả là ô QR nở ra chiếm cả trang.

            Đặt `top`/`bottom` thì chiều cao XÁC ĐỊNH trước (bằng chiều cao thẻ trừ padding),
            `aspect-square` mới suy được bề rộng. `max-h` chặn trên cho màn hẹp: ở đó badge
            xuống mấy dòng làm thẻ cao lên, mà QR thì không nên to theo. */}
        <PaymentQrButton
          organization={organization}
          className="absolute top-4 right-4 bottom-4 aspect-square h-auto max-h-20 w-auto"
        />
      </section>

      {isOwner ? (
        <EditOrganizationDialog
          organization={organization}
          open={editing}
          onClose={() => setEditing(false)}
        />
      ) : null}
    </>
  )
}
