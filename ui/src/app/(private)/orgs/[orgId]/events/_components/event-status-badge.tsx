import { Badge } from "@/components/ui/badge"
import type { EventStatus } from "@/types/event"

const LABEL_BY_STATUS: Record<EventStatus, string> = {
  OPEN: "Đang mở",
  COMPLETED: "Đã chốt sổ",
  CANCELLED: "Đã huỷ",
}

const VARIANT_BY_STATUS: Record<
  EventStatus,
  "default" | "secondary" | "destructive"
> = {
  OPEN: "default",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
}

/**
 * Input: Trạng thái buổi đánh.
 * Output: Badge tiếng Việt tương ứng.
 */
export function EventStatusBadge({ status }: { status: EventStatus }) {
  return <Badge variant={VARIANT_BY_STATUS[status]}>{LABEL_BY_STATUS[status]}</Badge>
}
