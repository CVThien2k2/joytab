"use client"

import { ChevronUp, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Sắc thái của thanh nhắc. Hai mức, và chỉ hai — đúng hai việc còn treo mà app này có:
 *
 *  - `primary`: tiền CỦA MÌNH chưa trả. Cùng màu với mọi nút hành động khác của app, vì đây là
 *    việc ai cũng phải làm chứ không phải một cảnh báo.
 *  - `amber`: buổi CHƯA CHỐT GIÁ, việc của chủ tổ chức. Đúng màu hổ phách mà thẻ trong sổ lịch
 *    sử tổ chức đã dùng cho trạng thái này, nên hai chỗ nói cùng một việc bằng cùng một màu.
 *
 * Không mức nào dùng đỏ: đỏ trong app này đã có nghĩa "tiền chưa về" ở góc nhìn người đi thu,
 * mà hai việc khác nhau cùng một màu thì cả màn hình chỉ còn một tín hiệu.
 */
const NOTICE_TONE = {
  primary: {
    bar: "bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-primary-foreground/40",
    shadow: "shadow-primary/25",
    icon: "bg-primary-foreground/15",
    chip: "bg-primary-foreground text-primary",
  },
  amber: {
    bar: "bg-amber-500 text-amber-950 hover:bg-amber-400 focus-visible:ring-amber-950/30 dark:bg-amber-400 dark:hover:bg-amber-300",
    shadow: "shadow-amber-900/20",
    icon: "bg-amber-950/10",
    chip: "bg-amber-950 text-amber-50",
  },
} as const

/**
 * Input: sắc thái + icon + câu nhắc, nhãn hành động nếu bấm được, và phần ruột nếu thanh này
 *        mở ra được.
 * Output: Một "viên thuốc" nhắc việc: icon có chấm báo, câu nhắc, chip hành động ở mép phải —
 *         và khi có `panel` thì chính nó là ĐỈNH của tấm mở ra bên dưới.
 *
 *         Là component dùng chung của MỌI thanh nhắc dính đáy, vì chúng phải trông y hệt nhau:
 *         người ta nhận ra "đây là việc còn treo" bằng chính hình dạng này, mà hai bản chép tay
 *         là hai chỗ sẽ trôi mỗi cái một kiểu ngay lần sửa đầu tiên.
 *
 *         Nền ĐẶC chứ không phải nền mờ: một dải nhạt nằm sát mép dưới trông như một phần của
 *         khung trang và mắt lướt qua mất. Bo tròn hết cỡ và có bóng để đọc ra ngay là thứ ĐẶT
 *         LÊN TRÊN trang — một việc đang chờ, không phải đồ trang trí của layout.
 *
 *         Mở ra bằng cách NỞ chính khối này chứ không phủ một tấm khác lên: khối bị ghim mép
 *         dưới, nên ruột dài ra là cả thanh nhắc bị đẩy LÊN và nó thành cái đỉnh của tấm vừa
 *         mở. Người ta thấy đúng một vật chuyển động, không phải một vật thứ hai bay tới che
 *         mất vật đang bấm.
 *
 *         Nở bằng `grid-template-rows: 0fr → 1fr` chứ không phải `height: auto`: `auto` không
 *         transition được, mà đo chiều cao bằng JS rồi set inline thì sai ngay khi danh sách
 *         bên trong đổi số dòng (chốt xong một buổi là bớt một dòng).
 *
 *         Chấm `animate-ping` ở góc icon là thứ DUY NHẤT động khi đứng yên, và nó tắt khi máy
 *         khai `prefers-reduced-motion`. Cả thanh nhấp nháy thì nhìn cả ngày sẽ thành thứ người
 *         ta muốn tắt, mà cái này lại không tắt được.
 *
 *         Không có `onClick` thì KHÔNG dựng ra `<button>`: thanh vẫn nói được câu của nó (ví dụ
 *         tổ chức chưa có tài khoản nhận tiền — có bấm cũng chẳng tới đâu), mà không hứa một
 *         đích bấm không tồn tại.
 */
export function NoticeBar({
  tone,
  icon: Icon,
  action,
  onClick,
  expanded = false,
  panel,
  children,
}: {
  tone: keyof typeof NOTICE_TONE
  icon: LucideIcon
  action?: string
  onClick?: () => void
  /** Ruột đang mở hay không. Chỉ có nghĩa khi có `panel`; nó xoay mũi tên và mở hàng lưới. */
  expanded?: boolean
  panel?: React.ReactNode
  children: React.ReactNode
}) {
  const style = NOTICE_TONE[tone]

  const header = (
    <>
      <span
        className={cn(
          "relative flex size-9 shrink-0 items-center justify-center rounded-full",
          style.icon,
        )}
      >
        <Icon className="size-4" aria-hidden="true" />
        {/* Chấm báo có việc: vòng `ping` loang ra rồi tắt, chấm đặc ở giữa đứng yên. Mở ruột ra
            rồi thì thôi nhắc — người ta đang nhìn thẳng vào chính cái việc đó. */}
        {expanded ? null : (
          <span className="absolute -top-0.5 -right-0.5 flex size-2.5">
            <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-60 motion-reduce:hidden" />
            <span className="relative inline-flex size-2.5 rounded-full bg-current" />
          </span>
        )}
      </span>

      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{children}</span>

      {action ? (
        <span
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold",
            style.chip,
          )}
        >
          {action}
          <ChevronUp
            className={cn(
              "size-3.5 transition-transform duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
              expanded && "rotate-180",
            )}
            aria-hidden="true"
          />
        </span>
      ) : null}
    </>
  )

  const headerClassName = cn(
    "flex w-full items-center gap-2.5 py-2 pr-2 pl-2.5 text-left transition-colors outline-none focus-visible:ring-[3px] focus-visible:ring-inset",
    style.bar,
  )

  return (
    <>
      {/* Tấm phủ mờ phía sau khi tấm đang mở: nói rằng chỗ còn lại của trang tạm thời không
          phải chỗ để làm gì, và cho một lối thoát ai cũng thử trước tiên — bấm ra ngoài là
          cụp. `-z-10` nên nó nằm SAU thanh nhắc nhưng vẫn trước nội dung trang (cả khối đã ở
          z-30). Luôn có mặt và chỉ đổi `opacity`, không gắn/tháo theo trạng thái: gắn vào thì
          không có gì để mờ DẦN lúc đóng, mà tấm phủ tắt phụp trong khi tấm dưới còn đang cụp
          là hai vật chạy hai nhịp. */}
      {panel ? (
        <div
          onClick={onClick}
          aria-hidden="true"
          className={cn(
            "pointer-events-auto fixed inset-0 -z-10 bg-black/10 transition-opacity duration-400 ease-[cubic-bezier(0.32,0.72,0,1)] supports-backdrop-filter:backdrop-blur-xs",
            expanded ? "opacity-100" : "pointer-events-none opacity-0",
          )}
        />
      ) : null}

      {/* `bg-card` là nền của phần ruột; phần đỉnh tự phủ màu của nó lên. Bo 1.625rem để lúc
          đóng (chỉ còn đỉnh) nó vẫn tròn đúng như một viên thuốc. */}
      <div
        className={cn(
          "pointer-events-auto mx-auto flex w-full max-w-2xl animate-in flex-col overflow-hidden rounded-[1.625rem] bg-card shadow-lg ring-1 ring-foreground/5 duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] fade-in slide-in-from-bottom-8 motion-reduce:animate-none",
          style.shadow,
        )}
      >
        {onClick ? (
          <button
            type="button"
            onClick={onClick}
            aria-expanded={panel ? expanded : undefined}
            className={headerClassName}
          >
            {header}
          </button>
        ) : (
          <div className={headerClassName}>{header}</div>
        )}

        {panel ? (
          // `inert` khi đóng: ruột chỉ bị CẮT bằng `overflow: hidden`, nó vẫn nằm nguyên trong
          // DOM — không khoá thì Tab vẫn nhảy vào được những cái nút vô hình, và trình đọc màn
          // hình vẫn đọc cả danh sách của một tấm đang đóng.
          <div
            inert={!expanded}
            className={cn(
              "grid transition-[grid-template-rows] duration-400 ease-[cubic-bezier(0.32,0.72,0,1)]",
              expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]",
            )}
          >
            {/* `min-h-0 overflow-hidden` là thứ làm hàng lưới 0fr cắt được ruột: thiếu nó thì ruột
              vẫn chiếm đủ chiều cao của mình và chẳng có gì đóng lại cả. */}
            <div className="min-h-0 overflow-hidden">{panel}</div>
          </div>
        ) : null}
      </div>
    </>
  )
}
