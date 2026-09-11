"use client"

import { useState } from "react"
import { Receipt } from "lucide-react"
import { toast } from "sonner"
import { getApiErrorMessage } from "@/api/error"
import { SettlementDialog } from "@/components/common/settlement-dialog"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { useFetchMatch } from "@/hooks/use-matches-api"
import type { MatchDetail } from "@/types/match"

/**
 * Input: id một buổi đã đá xong mà chưa chốt giá + id tổ chức.
 * Output: Nút "Chốt giá" mở THẲNG hộp thoại chốt chi phí, ngay tại chỗ đang đứng.
 *
 *         Hộp thoại cần danh sách NGƯỜI THAM GIA để tính trước tiền từng người, mà dòng trong
 *         sổ lịch sử chỉ mang vài avatar xem trước. Nên chi tiết trận chỉ nạp KHI BẤM (bằng
 *         `useFetchMatch`, không phải một query dựng sẵn): cả danh sách nạp sẵn là hai chục
 *         request cho một việc người ta làm mỗi lần một buổi. Trong lúc chờ thì chính nút quay
 *         spinner — không có hộp thoại rỗng nào mở ra trước rồi mới có dữ liệu.
 *
 *         Nạp xong thì hộp thoại NẰM LẠI trong cây (không tháo lúc đóng) để còn animation
 *         đóng. `key` đổi mỗi lần mở vì `SettlementDialog` chỉ đọc props lúc mount — cùng lý do
 *         đã ghi ở `SettlementSection`.
 */
export function SettleMatchButton({
  matchId,
  organizationId,
}: {
  matchId: string
  organizationId: string
}) {
  const fetchMatchDetail = useFetchMatch()

  const [match, setMatch] = useState<MatchDetail | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [openToken, setOpenToken] = useState(0)

  async function openDialog(): Promise<void> {
    setLoading(true)
    try {
      setMatch(await fetchMatchDetail(matchId))
      setOpenToken((token) => token + 1)
      setOpen(true)
    } catch (error) {
      toast.error(getApiErrorMessage(error, "Không mở được trận này. Vui lòng thử lại."))
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Button type="button" size="sm" onClick={() => void openDialog()} disabled={loading}>
        {loading ? <Spinner className="size-3.5" /> : <Receipt aria-hidden="true" />}
        Chốt giá
      </Button>

      {match ? (
        <SettlementDialog
          key={openToken}
          match={match}
          organizationId={organizationId}
          open={open}
          onOpenChange={setOpen}
          initialExpenses={[]}
          initialMaleRatio={match.maleRatio}
        />
      ) : null}
    </>
  )
}
