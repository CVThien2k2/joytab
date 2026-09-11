"use client"

import { useState } from "react"
import { UnpaidChargesBar } from "@/components/common/unpaid-charges-bar"
import { UnsettledMatchesBar } from "@/components/common/unsettled-matches-bar"

/**
 * Input: id tổ chức đang xem + người xem có phải chủ tổ chức không.
 * Output: Khu dính đáy màn hình chứa các thanh nhắc việc còn treo, xếp chồng nhau.
 *
 *         Có khối gom này vì hai thanh không thể tự dính đáy riêng lẻ: hai phần tử `sticky
 *         bottom-0` là hai phần tử ghim vào CÙNG một mép, chúng sẽ chồng lên nhau. Ghim một
 *         khối rồi xếp các thanh bên trong thì thêm thanh thứ ba cũng không phải tính lại gì.
 *
 *         `fixed` chứ không `sticky`: nó DÍNH màn hình và đè lên nội dung, không chiếm một ô
 *         nào trong luồng — nở tấm ra hay đóng lại đều không đẩy trang phía sau nhúc nhích.
 *         Đổi lại phải tự lùi mép trái qua khỏi sidebar (`md:left-62`, và `left-16` khi sidebar
 *         thu), thứ mà `sticky` trước đây được cho không.
 *
 *         `pointer-events-none` ở khối, `auto` ở từng thanh: khối trải hết bề ngang mép dưới,
 *         mà một khối `fixed` không nền vẫn ăn click như thường — để nguyên là cả một dải cao
 *         ~60px chạy suốt đáy MỌI trang nuốt mất cú bấm vào thứ nằm sau nó.
 *
 *         `empty:hidden` để lề dưới biến mất theo: mỗi thanh tự trả `null` khi hết việc, mà
 *         một khối rỗng vẫn còn `pb-3` thì trang tự dưng thừa một khoảng trắng không ai giải
 *         thích được. Hộp thoại của các thanh đi qua portal nên không tính là ruột của khối
 *         này — mở hộp thoại không làm khối rỗng hiện lại.
 *
 *         Nợ của MÌNH nằm dưới cùng, tức gần ngón cái nhất: trả tiền là việc của mọi người và
 *         làm nhiều lần, còn chốt giá chỉ chủ tổ chức làm, mỗi buổi một lần.
 *
 *         "Thanh nào đang mở" nằm Ở ĐÂY chứ không trong từng thanh: mở được cả hai cùng lúc là
 *         hai tấm phủ chồng nhau (nền tối gấp đôi) và một chồng nội dung cao hơn màn hình. Mở
 *         cái này thì cái kia tự cụp.
 */
export function OrgNoticeBars({
  organizationId,
  isOwner,
}: {
  organizationId: string
  isOwner: boolean
}) {
  const [openBar, setOpenBar] = useState<"unsettled" | "unpaid" | null>(null)

  function toggle(bar: "unsettled" | "unpaid"): void {
    setOpenBar((current) => (current === bar ? null : bar))
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-30 flex flex-col gap-2 px-3 pb-3 empty:hidden sm:px-6 md:left-62 sidebar-closed:md:left-16">
      {/* Sổ điều hành chỉ owner đọc được (BE trả ORG_004), nên member không dựng thanh này —
          không phải để giấu, mà để không gọi một API chắc chắn trả lỗi ở mọi trang. */}
      {isOwner ? (
        <UnsettledMatchesBar
          organizationId={organizationId}
          expanded={openBar === "unsettled"}
          onToggle={() => toggle("unsettled")}
        />
      ) : null}

      <UnpaidChargesBar
        organizationId={organizationId}
        expanded={openBar === "unpaid"}
        onToggle={() => toggle("unpaid")}
      />
    </div>
  )
}
