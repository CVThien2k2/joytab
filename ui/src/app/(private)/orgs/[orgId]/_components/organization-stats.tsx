"use client"

import Link from "next/link"
import { CalendarClock, CircleCheckBig, Eye, Trophy, Wallet, type LucideIcon } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { useOrganizationOverview } from "@/hooks/use-organizations-api"
import { formatMoney } from "@/lib/format"
import { cn } from "@/lib/utils"

/**
 * Nền/màu icon theo VỊ TRÍ thẻ (xanh dương → tím → lục → hổ phách). Chép nguyên bảng của hub
 * (components/stats/stat-card-grid.tsx) để hai app trông là một nhà.
 *
 * Màu gán theo vị trí chứ không theo ý nghĩa: bốn ô này không có ô nào "tốt" hay "xấu", chúng
 * chỉ là bốn con số — tô đỏ ô nợ là biến một sự thật bình thường thành lời cảnh báo thường trực.
 */
const STAT_ICON_CLASSES = [
  "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  "bg-violet-500/10 text-violet-600 dark:text-violet-400",
  "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
  "bg-amber-500/10 text-amber-600 dark:text-amber-400",
]

type StatCardItem = {
  label: string
  /** Không có = đang tải, phần số hiện skeleton. */
  value?: string
  Icon: LucideIcon
  /** Có = cả thẻ là một link, và hiện icon "xem" ở mép phải. */
  href?: string
  /** Câu cho trình đọc màn hình biết link đó dẫn đi đâu. Bắt buộc đi cùng `href`. */
  hrefLabel?: string
}

/**
 * Một thẻ thống kê — cùng bố cục với hub (components/stats/stat-card.tsx): ô icon bo tròn bên
 * trái, nhãn nhỏ rồi tới con số bên phải.
 *
 * Nhỏ hơn bản hub một nấc (ô icon 32px, số `text-base`) vì ở đây có BỐN thẻ và mobile xếp
 * 2 cột, mỗi thẻ chỉ còn ~165px: cỡ của hub sẽ đẩy "1.250.000đ" ra ngoài mép.
 *
 * Nhấc lên nửa nhịp khi rê chuột — cùng công thức với thẻ ứng dụng bên hub
 * (`app/(user)/apps/_components/app-card.tsx`): `-translate-y-0.5` + đổ bóng + viền đậm thêm
 * một nấc.
 */
function StatCard({
  label,
  value,
  Icon,
  href,
  hrefLabel,
  index,
}: StatCardItem & { index: number }) {
  const body = (
    <Card
      className={cn(
        "min-w-0 flex-row items-center gap-2.5 p-3 transition-all duration-200 sm:gap-3 sm:p-3.5",
        "hover:-translate-y-0.5 hover:shadow-md hover:ring-foreground/20",
        href && "h-full group-focus-visible/stat:ring-[3px] group-focus-visible/stat:ring-ring/50",
      )}
    >
      <span
        className={cn(
          "flex size-8 shrink-0 items-center justify-center rounded-lg sm:size-9",
          STAT_ICON_CLASSES[index % STAT_ICON_CLASSES.length],
        )}
      >
        <Icon className="size-4 sm:size-4.5" aria-hidden="true" />
      </span>

      <div className="min-w-0 flex-1">
        <div className="truncate text-[11px] text-muted-foreground sm:text-xs">{label}</div>

        {value == null ? (
          <Skeleton className="mt-1 h-5 w-16" />
        ) : (
          <div className="truncate text-base font-bold tracking-tight tabular-nums sm:text-lg">
            {value}
          </div>
        )}
      </div>

      {/* Con mắt nói thẻ này XEM ĐƯỢC chi tiết, không phải một con số chết. Đậm dần khi rê
          chuột thay vì chỉ hiện lúc hover: ẩn hẳn thì trên màn cảm ứng không ai biết bấm được. */}
      {href ? (
        <Eye
          className="size-4 shrink-0 text-muted-foreground/60 transition-colors group-hover/stat:text-foreground"
          aria-hidden="true"
        />
      ) : null}
    </Card>
  )

  if (!href) return body

  return (
    <Link href={href} className="group/stat min-w-0 rounded-xl outline-none">
      {body}
      <span className="sr-only">{hrefLabel}</span>
    </Link>
  )
}

/**
 * Input: id tổ chức đang xem.
 * Output: Bốn con số của trang chủ: tiền còn phải trả, tiền đã trả, số buổi đã chơi, số buổi
 *         sắp tới.
 *
 *         Hai ô tiền đứng trước hai ô đếm buổi: tiền là thứ người ta liếc vào trước, còn số
 *         buổi là thứ để biết.
 *
 *         Ô "Cần thanh toán" DẪN sang trang Lịch sử đấu: ở đó mới nhìn ra số tiền này đến từ
 *         những buổi nào, và cũng chính là chỗ trả tiền. Trang chủ vì vậy không mang nút trả —
 *         một con số kèm đường đi tới chỗ giải quyết thì gọn hơn một nút nằm giữa màn hình.
 *
 *         Lưới 2 cột trên mobile chứ không xếp dọc bốn hàng: xếp dọc thì phải cuộn qua cả bốn
 *         ô mới tới danh sách buổi đá — mà danh sách mới là thứ người ta mở app để xem.
 *
 *         Đang tải thì khung thẻ đã có sẵn, chỉ phần SỐ là skeleton (cách hub làm): bố cục
 *         không nhảy một nhịp nào khi số về, và người ta đọc được ngay bốn ô này sắp nói gì.
 *
 *         Bốn con số tới từ MỘT request (`/organizations/:id/overview`) nên chúng luôn nói về
 *         cùng một thời điểm.
 */
export function OrganizationStats({ organizationId }: { organizationId: string }) {
  const { data } = useOrganizationOverview(organizationId)

  const cards: StatCardItem[] = [
    {
      label: "Cần thanh toán",
      value: data && `${formatMoney(data.unpaidTotal)}đ`,
      Icon: Wallet,
      href: `/orgs/${organizationId}/history`,
      hrefLabel: "Xem chi tiết ở Lịch sử đấu",
    },
    {
      label: "Đã thanh toán",
      value: data && `${formatMoney(data.paidTotal)}đ`,
      Icon: CircleCheckBig,
    },
    {
      label: "Trận đã chơi",
      value: data && String(data.playedCount),
      Icon: Trophy,
    },
    {
      label: "Sắp diễn ra",
      value: data && String(data.upcomingCount),
      Icon: CalendarClock,
    },
  ]

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:gap-3 lg:grid-cols-4">
      {cards.map((card, index) => (
        <StatCard key={card.label} {...card} index={index} />
      ))}
    </div>
  )
}
