"use client"

import { useState } from "react"
import { CalendarIcon, X } from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Calendar, type DateRange } from "@/components/ui/calendar"
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useIsMobile } from "@/hooks/use-media-query"
import { formatDate } from "@/lib/format"
import type { ChargePaymentStatus, MatchStatus } from "@/types/match"

/** Hai trạng thái làm nên lịch sử. `open` không có ở đây: nó là việc đang treo, không phải quá khứ. */
const STATUS_OPTIONS: { value: Extract<MatchStatus, "settled" | "canceled">; label: string }[] = [
  { value: "settled", label: "Đã chốt tiền" },
  { value: "canceled", label: "Đã huỷ" },
]

/** Nhãn giữ đúng chữ của badge trên thẻ (`match-card`) — cùng một trạng thái thì cùng một tên. */
const PAYMENT_OPTIONS: { value: ChargePaymentStatus; label: string }[] = [
  { value: "paid", label: "Đã trả" },
  { value: "unpaid", label: "Chưa trả" },
]

export type MatchHistoryFilterValues = {
  /** Khoảng ngày đang lọc. `undefined` = không giới hạn thời gian. */
  range: DateRange | undefined
  status: MatchStatus[]
  paymentStatus: ChargePaymentStatus[]
}

export const NO_HISTORY_FILTER: MatchHistoryFilterValues = {
  range: undefined,
  status: [],
  paymentStatus: [],
}

/**
 * Input: giá trị lọc hiện tại + hàm đổi.
 * Output: `true` nếu đang lọc theo bất kỳ trục nào.
 *
 *         Khai ở đây chứ không ở chỗ dùng: danh sách cần biết để chọn câu "không có buổi nào"
 *         cho đúng, mà hai bản sao của cùng một điều kiện thì sẽ có lúc lệch nhau.
 */
export function hasHistoryFilter(values: MatchHistoryFilterValues): boolean {
  return (
    values.range?.from !== undefined || values.status.length > 0 || values.paymentStatus.length > 0
  )
}

/**
 * Input: giá trị lọc hiện tại + hàm đổi (component ĐƯỢC ĐIỀU KHIỂN, không giữ state riêng).
 * Output: Thanh lọc của trang Lịch sử: khoảng ngày, trạng thái trận, trạng thái thanh toán.
 *
 *         Khoảng ngày chép từ hub (components/stats/date-range-filter): MỘT lịch chọn cả hai
 *         đầu trong cùng một lần mở, và chỉ ghi ra ngoài khi đã chọn đủ hai đầu — khoảng dở dang
 *         không làm danh sách tải lại giữa chừng. Khác hub hai chỗ, và đều vì chỗ dùng khác:
 *         nguồn sự thật ở đây là state của trang chứ không phải URL (ba bộ lọc phải cùng một
 *         nguồn), và KHÔNG chặn ngày tương lai (một buổi đã huỷ có thể nằm ở tương lai, chặn đi
 *         là lọc không ra nó).
 *
 *         Hai bộ lọc trạng thái là dropdown TÍCH NHIỀU Ô kèm badge đếm, theo đúng lối
 *         `/admin/users` bên hub: mảng rỗng nghĩa là không lọc, nên không cần một mục "Tất cả"
 *         giả — thứ luôn phải nhớ bỏ tích khi chọn cái khác.
 *
 *         `onSelect` bị chặn ở từng ô tích để menu KHÔNG đóng sau mỗi lần bấm: chọn hai trạng
 *         thái là hai lần mở menu nếu không chặn.
 */
export function MatchHistoryFilters({
  values,
  onChange,
}: {
  values: MatchHistoryFilterValues
  onChange: (values: MatchHistoryFilterValues) => void
}) {
  const isMobile = useIsMobile()
  const [open, setOpen] = useState(false)
  /** Khoảng đang chọn dở (mới bấm đầu thứ nhất); đóng lịch là bỏ, quay về khoảng đang lọc. */
  const [draft, setDraft] = useState<DateRange>()

  function selectRange(range: DateRange | undefined): void {
    setDraft(range)
    if (!range?.from || !range.to) return
    onChange({ ...values, range })
  }

  function toggle<T extends string>(list: T[], value: T, checked: boolean): T[] {
    return checked ? [...list, value] : list.filter((item) => item !== value)
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Popover
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) setDraft(undefined)
        }}
      >
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            aria-label="Lọc theo khoảng ngày"
            className="justify-start gap-2 font-normal tabular-nums"
          >
            <CalendarIcon className="size-4 text-muted-foreground" aria-hidden="true" />
            {values.range?.from && values.range.to ? (
              <span>
                {formatDate(values.range.from.toISOString())}
                <span className="mx-1.5 text-muted-foreground/60">→</span>
                {formatDate(values.range.to.toISOString())}
              </span>
            ) : (
              // Chưa lọc thì nói ra là đang xem TẤT CẢ, không để trống: một nút lịch trống dễ
              // đọc thành "chưa chọn được gì" trong khi danh sách vẫn đang đầy đủ.
              <span>Mọi thời điểm</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          {/* Một tháng trên mobile: hai tháng cạnh nhau là ~560px, tràn khỏi màn 360px. */}
          <Calendar
            mode="range"
            numberOfMonths={isMobile ? 1 : 2}
            defaultMonth={values.range?.from}
            selected={draft ?? values.range}
            onSelect={selectRange}
            autoFocus
          />
        </PopoverContent>
      </Popover>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="gap-1.5 font-normal">
            Trạng thái
            {values.status.length > 0 ? (
              <Badge variant="secondary" className="px-1.5">
                {values.status.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {STATUS_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={values.status.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange({ ...values, status: toggle(values.status, option.value, checked) })
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button type="button" variant="outline" className="gap-1.5 font-normal">
            Thanh toán
            {values.paymentStatus.length > 0 ? (
              <Badge variant="secondary" className="px-1.5">
                {values.paymentStatus.length}
              </Badge>
            ) : null}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-44">
          {PAYMENT_OPTIONS.map((option) => (
            <DropdownMenuCheckboxItem
              key={option.value}
              checked={values.paymentStatus.includes(option.value)}
              onSelect={(event) => event.preventDefault()}
              onCheckedChange={(checked) =>
                onChange({
                  ...values,
                  paymentStatus: toggle(values.paymentStatus, option.value, checked),
                })
              }
            >
              {option.label}
            </DropdownMenuCheckboxItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Chỉ hiện khi có gì để xoá: một nút "Xoá filter" mờ nằm sẵn ở đó không nói được là đang
          lọc hay không lọc. */}
      {hasHistoryFilter(values) ? (
        <Button
          type="button"
          variant="outline"
          className="gap-1 border-dashed border-destructive text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onChange(NO_HISTORY_FILTER)}
        >
          <X className="size-4" aria-hidden="true" />
          Xoá filter
        </Button>
      ) : null}
    </div>
  )
}
