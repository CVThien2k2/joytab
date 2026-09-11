"use client"

import { Receipt } from "lucide-react"
import { NoticeBar } from "@/components/common/notice-bar"
import { UnsettledMatchesPanel } from "@/components/common/unsettled-matches-panel"
import { useOrganizationHistory } from "@/hooks/use-matches-api"

/**
 * Input: id tổ chức đang xem. CHỈ dựng cho chủ tổ chức (xem `OrgNoticeBars`).
 * Output: Thanh nhắc "còn buổi chưa chốt giá"; bấm vào là chính nó bị đẩy lên và danh sách nở
 *         ra bên dưới. Không còn buổi nào thì KHÔNG render gì.
 *
 *         Đi theo chủ tổ chức ở MỌI trang chứ không nằm trong một trang: chốt giá là việc chặn
 *         dòng tiền của cả nhóm — chưa chốt thì không ai trả được đồng nào — nên không thể chờ
 *         họ nhớ ghé trang Lịch sử tổ chức.
 *
 *         Đóng/mở bằng chính thanh nhắc, không có tấm phủ và không có nút X: bấm lần nữa là
 *         cụp lại. Danh sách nở ra ngay dưới nó nên không che mất trang phía sau — người ta vẫn
 *         thấy mình đang đứng ở đâu trong lúc chốt.
 *
 *         KHÔNG có nút đóng hẳn: việc chưa xong thì thanh còn đó. Chốt nốt buổi cuối là nó tự
 *         biến mất — đó mới là cách tắt nó, chứ không phải giấu đi một việc vẫn còn nguyên.
 */
export function UnsettledMatchesBar({
  organizationId,
  expanded,
  onToggle,
}: {
  organizationId: string
  expanded: boolean
  onToggle: () => void
}) {
  const { data, hasNextPage } = useOrganizationHistory(organizationId, "unsettled")

  const count = data?.pages.flatMap((page) => page.matches).length ?? 0
  // Còn lô sau thì con số đang đếm mới là một lô đầu: "20+" nói đúng thứ mình biết, còn "20"
  // trần là một lời khẳng định sai.
  const label = hasNextPage ? `${count}+` : String(count)

  // Đang mở mà hết việc thì vẫn giữ lại: ruột tự nói "đã chốt giá hết rồi". Biến mất ngay lúc
  // bấm xong buổi cuối là người ta không kịp thấy việc mình vừa làm có hiệu lực.
  if (count === 0 && !expanded) return null

  return (
    <NoticeBar
      tone="amber"
      icon={Receipt}
      action={expanded ? "Thu gọn" : "Chốt ngay"}
      onClick={onToggle}
      expanded={expanded}
      panel={<UnsettledMatchesPanel organizationId={organizationId} expanded={expanded} />}
    >
      {count > 0 ? (
        <>
          Còn <span className="tabular-nums">{label}</span> trận chưa chốt giá
        </>
      ) : (
        <>Đã chốt giá xong hết</>
      )}
    </NoticeBar>
  )
}
