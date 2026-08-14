import { Badge } from "@/components/ui/badge"
import type { DebtStatus } from "@/types/billing"

const LABEL_BY_STATUS: Record<DebtStatus, string> = {
  UNPAID: "Chưa trả",
  PARTIAL: "Trả một phần",
  PAID: "Đã trả",
}

const VARIANT_BY_STATUS: Record<
  DebtStatus,
  "default" | "secondary" | "destructive"
> = {
  UNPAID: "destructive",
  PARTIAL: "default",
  PAID: "secondary",
}

/**
 * Input: Trạng thái nợ do BE tính lúc đọc.
 * Output: Badge tiếng Việt tương ứng.
 */
export function DebtStatusBadge({ status }: { status: DebtStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</Badge>
}
